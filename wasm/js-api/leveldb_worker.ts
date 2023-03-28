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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

onmessage = async (e) => {
  while (true) {
    console.log("did something");
    await sleep(1000);
  }
  handlers[e.data[0]](e.data.slice(1));
};
