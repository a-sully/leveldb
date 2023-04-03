import { get as idbGet, set as idbSet, setMany as idbSetMany, clear as idbClear, del as idbDel, entries as idbReadAll } from './idbkv/index.js';
import { LevelDb } from './leveldb_db.js';

const dbName = 'benchmark-db';
const sqliteDbName = 'sql.db';

// Default values for benchmark parameters.
let numReads = 10000;
let numEntries = 10000;
let valueSize = 10000;

// Backend #1
const indexedDb = {
  waitUntilOpen: async () => { return },
  get: idbGet,
  set: idbSet,
  setMany: idbSetMany,
  remove: idbDel,
  clear: idbClear,
  readAll: idbReadAll,
}

// Backend #2
class LevelDbImpl {
  static instance_;
  db_;

  constructor(dbName) {
    this.db_ = new LevelDb(dbName);
  }

  static getInstance() {
    if (!LevelDbImpl.instance_)
      LevelDbImpl.instance_ = new LevelDbImpl('opfs/' + dbName);
    return LevelDbImpl.instance_;
  }

  async waitUntilOpen() { return; }

  get(key) {
    return this.db_.get(key);
  }

  set(key, val) {
    return this.db_.put(key, val);
  }

  setMany(pairs) {
    return this.db_.putMany(pairs);
  }

  remove(key) {
    return this.db_.remove(key);
  }

  async clear() {
    await this.db_.close();
    let opfsRoot = await navigator.storage.getDirectory();
    return opfsRoot.removeEntry(dbName, { recursive: true });
  }

  async readAll() {
    const iter = await this.db_.newIterator();
    const items = [];
    for (await iter.seekToFirst(); iter.valid; await iter.next()) {
    }
  }
}

// Backend #3
//
// Uses SQLite's Promiser wrapper for easy use of the sqlite3 library from the
// main thread. See https://sqlite.org/wasm/doc/tip/api-worker1.md#promiser
class SqliteImpl {
  static instance_;
  worker_;
  promiser_;
  set_value_queue_ = {};

  static getInstance() {
    if (!SqliteImpl.instance_)
      SqliteImpl.instance_ = new SqliteImpl('sqlite.db');
    return SqliteImpl.instance_;
  }

  async waitUntilOpen() {
    return new Promise(resolve => {
      this.promiser_ = self.sqlite3Worker1Promiser(async () => {
        this.promiser_('open', { filename: 'file:' + sqliteDbName + '?vfs=opfs' }).then((msg)=>{
          this.promiser_('exec', { sql: 'CREATE TABLE IF NOT EXISTS store (key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID' }).then((msg)=>{
            this.promiser_('exec', { sql: 'CREATE INDEX key_index ON store (key)' }).then((msg)=>{
              resolve();
            }).catch((e)=>{
              console.error('creating index failed:', e);
              resolve();
            })
          }).catch((e)=>{
            console.error('creating table failed:', e);
            reject(e);
          })
        }).catch((e)=>{
          console.error('opening database file failed:', e);
          reject(e);
        })
      })
    });
  }

  async get(key) {
    let results = [];
    await this.promiser_('exec', {sql: 'SELECT value FROM store WHERE key=\'' + key + '\'', callback: (result) => {
      if (result['row'] != undefined) {
        results.push(result['row'][0]);
      }
    }});
    console.assert(results.length == 0 || results.length == 1)
    return results[0];
  }

  set(key, val) {
    return this.promiser_('exec', {sql: 'INSERT OR REPLACE INTO store (key, value) VALUES (\'' + key + '\',\'' + val + '\')'});
  }

  async setMany(pairs) {
    // TODO: This may not be correct, depending on the order in which the set
    // calls hit the worker. But that doesn't really matter for the purpose of
    // these benchmarks.
    //
    // This is also ripe for optimization. For example, we could:
    //  - initialize and use SQLite from a worker rather than using the
    //    sqlite3Worker1Promiser to post to the worker for each operation.
    //  - insert multiple values at a time, though I believe this would
    //    require removing duplciates. e.g. you can do this:
    //        INSERT ... VALUES ('a', 'b'), ('c', 'd'), ('e', 'f')
    //    but you can't do this if you want unique keys:
    //        INSERT ... VALUES ('a', 'b'), ('a', 'd'), ('a', 'f')
    let promises = [];
    for (const [key, value] in pairs) {
      promises.push(this.set(key, value));
    }
    return Promise.all(promises);
  }

  remove(key) {
    return this.promiser_('exec', {sql: 'DELETE FROM store WHERE key=\'' + key + '\''});
  }

  async clear() {
    return this.promiser_('close', {unlink: true});
  }

  async readAll() {
    let results = [];
    await this.promiser_('exec', {sql: 'SELECT key, value FROM store', callback: (result) => {
      if (result['row'] != undefined) {
        results.push([result['row'][0], result['row'][1]]);
      }
    }});
    return results[0];
  }
}

let activeBackend;

let savedKeys = [];

function getEm(id) {
  return document.getElementById(id);
}

function writeOutput(text) {
  getEm('output-area').textContent += text + '\n';
}

function toKey(i) {
  return i.toString(16).padStart(8, '0');
}

/* Set up the kv pair db by writing a bunch of data. */
async function doWrites(startTimer) {
  let pairs = [];
  const maxVal = Math.pow(36, 8);
  savedKeys = [];
  for (let i = 0; i < numEntries; ++i) {
    let value = Array.from({ length: valueSize / 8 }, (i) => Math.floor(Math.random() * maxVal).toString(36)).join('');
    let key = toKey(i);
    savedKeys.push(key);
    pairs.push([key, value]);
  }
  // Generation of random keys and values is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();
  return activeBackend.setMany(pairs);
}

const tests = {
  readAll: async function (startTimer) {
    startTimer();
    await activeBackend.readAll();
  },

  readRandom: async function (startTimer) {
    let keys = [];
    let promises = [];
    for (let i = 0; i < numReads; ++i) {
      // Select randomly among existing keys.
      keys.push(savedKeys[Math.floor(Math.random() * savedKeys.length)]);
    }
    // Selection of keys is not an interesting thing to test, so don't start the timer until that's done.
    startTimer();

    keys.forEach((key) => promises.push(activeBackend.get(key)));
    // These promises should all resolve since the keys do exist.
    return Promise.all(promises);
  },

  readMissing: async function (startTimer) {
    let keys = [];
    let promises = [];
    for (let i = 0; i < numReads; ++i) {
      // Make up new keys.
      keys.push(Math.random().toString());
    }
    // Generation of random keys is not an interesting thing to test, so don't start the timer until that's done.
    startTimer();

    keys.forEach((key) => promises.push(activeBackend.get(key)));
    // These promises should reject (depending on backend) since the keys don't exist.
    return Promise.allSettled(promises);
  },

  readHot: async function (startTimer) {
    let keys = [];
    let promises = [];
    for (let i = 0; i < numReads; ++i) {
      // Select randomly among existing keys, but only 1%.
      keys.push(savedKeys[99 * Math.floor(Math.random() * (savedKeys.length / 100))]);
    }
    // Generation of keys is not an interesting thing to test, so don't start the timer until that's done.
    startTimer();

    keys.forEach((key) => promises.push(activeBackend.get(key)));
    // These promises should all resolve since the keys do exist.
    return Promise.all(promises);
  },

  deleteRandom: async function (startTimer) {
    let keys = [];
    let promises = [];
    for (let i = 0; i < numReads; ++i) {
      // Select randomly among existing keys.
      keys.push(savedKeys[Math.floor(Math.random() * savedKeys.length)]);
    }
    // Selection of keys is not an interesting thing to test, so don't start the timer until that's done.
    startTimer();

    keys.forEach((key) => promises.push(activeBackend.remove(key)));
    // These promises should all resolve since the keys do exist.
    return Promise.all(promises);
  },

  deleteSequential: async function (startTimer) {
    let keys = [];
    let promises = [];
    for (let i = 0; i < numReads; ++i) {
      // Select randomly among existing keys.
      keys.push(savedKeys[i]);
    }
    // Selection of keys is not an interesting thing to test, so don't start the timer until that's done.
    startTimer();

    keys.forEach((key) => promises.push(activeBackend.remove(key)));
    // These promises should all resolve since the keys do exist.
    return Promise.all(promises);
  },
}

function updateTestDescriptions() {
  tests.readAll.description = 'reads all items from the database using an iterator/cursor';
  tests.readRandom.description = 'reads ' + numReads + ' random keys that exist in the database';
  tests.readMissing.description = 'reads ' + numReads + ' random keys that are not in the database';
  tests.readHot.description = 'reads 1% of the keys in the database ' + numReads + ' times';
  tests.deleteRandom.description = 'deletes ' + numReads + ' keys at random';
  tests.deleteSequential.description = 'deletes ' + numReads + ' keys in order';
}

async function fillStore() {
  writeOutput('Filling in store, with ' + numEntries + ' kv pairs, each value about ' + valueSize + 'B');
  let t0;
  await doWrites(() => t0 = performance.now());
  const t1 = performance.now();
  writeOutput('   ... took ' + (t1 - t0) + 'ms');
}

async function benchmark(fn) {
  writeOutput('Running [' + fn.name + '], which ' + fn.description + '...');
  let t0;
  await fn(() => t0 = performance.now());
  const t1 = performance.now();
  writeOutput('   ... took ' + (t1 - t0) + 'ms');
}

async function runBenchmarks() {
  getEm('output-area').textContent = '';
  getEm('run-button').disabled = true;

  const reads = parseInt(getEm('numReads').textContent);
  if (!isNaN(reads))
    numReads = reads;
  const entries = parseInt(getEm('numEntries').textContent);
  if (!isNaN(entries))
    numEntries = entries;
  const valueBytes = parseInt(getEm('valueSize').textContent);
  if (!isNaN(valueBytes))
    valueSize = valueBytes;
  updateTestDescriptions();

  if (getEm('idbkv').checked)
    activeBackend = indexedDb;
  else if (getEm('sqlitewasm').checked)
    activeBackend = SqliteImpl.getInstance();
  else
    activeBackend = LevelDbImpl.getInstance();

  writeOutput('Generating random data...');

  await activeBackend.waitUntilOpen();

  // The generation is slow and bogs down the UI thread so give the above UI updates a chance to cycle.
  setTimeout(() => fillStore().then(async (resolve, reject) => {
    for (const testName of Object.keys(tests)) {
      if (getEm(testName).checked)
        await benchmark(tests[testName]);
    };
    getEm('run-button').disabled = false;
  }));
}

window.onload = function () {
  getEm('run-button').onclick = runBenchmarks;
  getEm('clear-button').onclick = (event) => {
    let backend;
    if (getEm('idbkv').checked)
      backend = indexedDb;
    else if (getEm('sqlitewasm').checked)
      backend = SqliteImpl.getInstance();
    else
      backend = LevelDbImpl.getInstance();
    backend.clear();
  };
}
