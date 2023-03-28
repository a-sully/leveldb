import { LevelDb } from './leveldb.js';

let db = new LevelDb('hello_world');
db.put('key', 'value');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

  while (true) {
    console.log("did nothing");
    await sleep(1000);
  }
