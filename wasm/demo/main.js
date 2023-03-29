import { LevelDb } from './leveldb_db.js';

let db = new LevelDb('hello_world');

try {
  await db.put('key', 'value');
  console.log('I put therefore I am');
} catch (e) {
  console.log(e);
}
