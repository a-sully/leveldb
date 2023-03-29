import { get, set, setMany } from './idbkv/index.js';

const numReads = 10000;
const numWrites = 10000;
const valueSize = 10000;

/* Set up the kv pair db by writing a bunch of data. */
async function doWrites(startTimer) {
  let pairs = [];
  const maxVal = Math.pow(36, 8);
  for (let i = 0; i < numWrites; ++i) {
    let key = Math.random().toString(16).slice(2);
    let value = Array.from({length: valueSize / 8}, (i) => Math.floor(Math.random() * maxVal).toString(36));
    pairs.push(key, value);
  }
  // Generation of random keys and values is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();
  return setMany(pairs);
}

async function readMissingTest(startTimer) {
  let keys = [];
  let promises = [];
  for (let i = 0; i < numReads; ++i) {
    keys.push(Math.random().toString(16).slice(2));
  }
  // Generation of random keys is not an interesting thing to test, so don't start the timer until that's done.
  startTimer();

  keys.forEach((key) => promises.push(get(key)));
  return Promise.all(promises);
}
readMissingTest.description = 'reads ' + numReads + ' random keys that are not in the database';

async function benchmark(fn) {
  {
    console.log('Setting up store, with ' + numWrites + ' kv pairs, each value about ' + valueSize + 'B');
    let t0;
    await doWrites(() => t0 = performance.now());
    const t1 = performance.now();
    console.log('   ... took ' + (t1 - t0) + 'ms');
  }
  {
    console.log('Running [' + fn.name +'], which ' + fn.description + '...');
    let t0;
    await fn(() => t0 = performance.now());
    const t1 = performance.now();
    console.log('   ... took ' + (t1 - t0) + 'ms');
  }
}

function runBenchmarks() {
  benchmark(readMissingTest);
}

runBenchmarks();
