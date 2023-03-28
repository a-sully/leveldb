import { LevelDb } from "./leveldb"
import { DbWrapper } from "./glue.js"

let databases = {}

const handlers = {
  open([db]){
    databases[db.getName()] = new DbWrapper(db.getName());
  },

  put([db, k, v]){
    databases[db.getName()].put(k, v);
  }
}

onmessage = (e) => {
  handlers[e.data[0]](e.data.slice(1));
};
