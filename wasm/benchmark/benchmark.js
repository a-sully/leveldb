import { get as idbGet, set as idbSet, setMany as idbSetMany, clear as idbClear} from './idbkv/index.js';
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
      LevelDbImpl.instance_ = new LevelDbImpl('opfs/benchmark3-db');
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

function generateKey() {
  return Math.random().toString(16).slice(2);
}

/* Set up the kv pair db by writing a bunch of data. */
async function doWrites(startTimer) {
  let pairs = [];
  const maxVal = Math.pow(36, 8);
  savedKeys = [];
  for (let i = 0; i < numEntries; ++i) {
    let value = Array.from({length: valueSize / 8}, (i) => Math.floor(Math.random() * maxVal).toString(36)).join('');
    let key = generateKey();
    savedKeys.push(key);
    pairs.push([key, value]);
  }
  // Generation of random keys and values is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();
  return activeBackend.setMany(pairs);
}

async function readMissingTest(startTimer) {
  let keys = [];
  let promises = [];
  for (let i = 0; i < numReads; ++i) {
    keys.push(generateKey() + 'g');
  }
  // Generation of random keys is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();

  keys.forEach((key) => promises.push(activeBackend.get(key)));
  // These promises should reject (depending on backend) since the keys don't exist.
  return Promise.allSettled(promises);
}
readMissingTest.description = 'reads ' + numReads + ' random keys that are not in the database';

async function readHotTest(startTimer) {
  let keys = [];
  let promises = [];
  for (let i = 0; i < 1; ++i) {
    keys.push(savedKeys[Math.floor(Math.random() * (savedKeys.length / 100))]);
  }
  // Generation of keys is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();

  keys.forEach((key) => promises.push(activeBackend.get(key)));
  // These promises should all resolve since the keys do exist.
  return Promise.all(promises);
}
readHotTest.description = 'reads 1% of the keys in the database ' + numReads + ' times';

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

  if (getEm('idbkv').checked)
    activeBackend = indexedDb;
  else
    activeBackend = LevelDbImpl.getInstance();

  activeBackend.clear();
  writeOutput('Generating random data...');

  // The generation is slow and bogs down the UI thread so give the above UI updates a chance to cycle.
  setTimeout(() => fillStore().then(async (resolve, reject) => {
    if (getEm('readMissing').checked)
      await benchmark(readMissingTest);
    if (getEm('readHot').checked)
      await benchmark(readHotTest);
    getEm('run-button').disabled = false;
  }));
}

window.onload = function() {
  getEm('run-button').onclick = runBenchmarks;
}
