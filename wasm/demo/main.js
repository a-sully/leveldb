import { LevelDb } from './leveldb_db.js';

let db = new LevelDb('hello_world');
db.put('key', 'value');
