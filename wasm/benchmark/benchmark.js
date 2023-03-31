import { get as idbGet, set as idbSet, setMany as idbSetMany, clear as idbClear, del as idbDel} from './idbkv/index.js';
import { LevelDb } from './leveldb_db.js';

// Default values for benchmark parameters.
let numReads = 10000;
let numEntries = 10000;
let valueSize = 10000;

// Backend #1
const indexedDb = {
  get: idbGet,
  set: idbSet,
  setMany: idbSetMany,
  remove: idbDel,
  clear: idbClear,
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
      LevelDbImpl.instance_ = new LevelDbImpl('opfs/benchmark-db');
    return LevelDbImpl.instance_;
  }

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

  clear() {
    return null;
    // notimpl
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
    let value = Array.from({length: valueSize / 8}, (i) => Math.floor(Math.random() * maxVal).toString(36)).join('');
    let key = toKey(i);
    savedKeys.push(key);
    pairs.push([key, value]);
  }
  // Generation of random keys and values is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();
  return activeBackend.setMany(pairs);
}

const tests = {
  readRandom: async function(startTimer) {
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

  readMissing: async function(startTimer) {
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

  readHot: async function(startTimer) {
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

  deleteRandom: async function(startTimer) {
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

  deleteSequential: async function(startTimer) {
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
  writeOutput('Running [' + fn.name +'], which ' + fn.description + '...');
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
  else
    activeBackend = LevelDbImpl.getInstance();

  activeBackend.clear();
  writeOutput('Generating random data...');

  // The generation is slow and bogs down the UI thread so give the above UI updates a chance to cycle.
  setTimeout(() => fillStore().then(async (resolve, reject) => {
    for (const testName of Object.keys(tests)) {
      if (getEm(testName).checked)
        await benchmark(tests[testName]);
    };
    getEm('run-button').disabled = false;
  }));
}

window.onload = function() {
  getEm('run-button').onclick = runBenchmarks;
  getEm('clear-button').onclick = (event) => {
    let backend = LevelDbImpl.getInstance();
    if (getEm('idbkv').checked)
      backend = indexedDb;
    backend.clear();
  };
}
