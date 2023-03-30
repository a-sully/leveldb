import { get as idbGet, set as idbSet, setMany as idbSetMany, clear as idbClear} from './idbkv/index.js';
import { LevelDb } from './leveldb_db.js';

const numReads = 10000;
const numEntries = 10000;
const valueSize = 10000;

const indexedDb = {
  get: idbGet,
  set: idbSet,
  setMany: idbSetMany,
  clear: idbClear,
}

class LevelDbImpl = {
  private static instance_;
  private db_;

  private constructor(dbName) {
    db_ = new LevelDb(dbName);
  }

  public getInstance() {
    if (!instance_)
      instance_ = new LevelDbImpl('benchmark-db');
    return instance_;
  }

  public get(key) {
    return db_.get(key);
  }

  public set(key, val) {
    return db_.set(key, val);
  }

  public setMany(pairs) {
    return null; // db_.setMany(pairs);
  }

  public clear() {
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

function generateKey(range) {
  return Math.floor(Math.random() * range).toString(16).padStart(range / 16, '0');
}

/* Set up the kv pair db by writing a bunch of data. */
async function doWrites(startTimer) {
  let pairs = [];
  const maxVal = Math.pow(36, 8);
  savedKeys = [];
  for (let i = 0; i < numEntries; ++i) {
    let value = Array.from({length: valueSize / 8}, (i) => Math.floor(Math.random() * maxVal).toString(36));
    let key = generateKey(numEntries * 16);
    savedKeys.push(key);
    pairs.push(key, value);
  }
  // Generation of random keys and values is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();
  return activeBackend.setMany(pairs);
}

async function readMissingTest(startTimer) {
  let keys = [];
  let promises = [];
  for (let i = 0; i < numReads; ++i) {
    keys.push(generateKey(numEntries));
  }
  // Generation of random keys is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();

  keys.forEach((key) => promises.push(activeBackend.get(key)));
  return Promise.all(promises);
}
readMissingTest.description = 'reads ' + numReads + ' random keys that are not in the database';

async function readHotTest(startTimer) {
  let keys = [];
  let promises = [];
  for (let i = 0; i < numReads; ++i) {
    keys.push(savedKeys[Math.floor(Math.random() * (savedKeys.length / 100))];
  }
  // Generation of keys is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();

  keys.forEach((key) => promises.push(activeBackend.get(key)));
  return Promise.all(promises);
}
readMissingTest.description = 'reads 1% of the keys in the database ' + numReads + ' times';

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
  if (getEm('idbkv').checked)
    activeBackend = indexedDb;
  else
    activeBackend = LevelDbImpl.getInstance();

  activeBackend.clear();
  writeOutput('Generating random data...');

  // The generation is slow and bogs down the UI thread so give the above UI updates a chance to cycle.
  setTimeout(() => await fillStore());
  await benchmark(readMissingTest);

  getEm('run-button').disabled = false;
}

window.onload = function() {
  getEm('run-button').onclick = runBenchmarks;
}
