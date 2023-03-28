import { LevelDb } from './leveldb.js';

let db = new LevelDb('hello_world');
db.put('key', 'value');
