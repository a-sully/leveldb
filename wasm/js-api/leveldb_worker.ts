import Module from "./leveldbwasm.js"

let databases = {}
let moduleInstance = undefined;

const handlers = {
  open([db]){
    databases[db.dbName_] = new moduleInstance.DbWrapper(db.dbName_);
  },

  put([db, k, v]){
    databases[db.dbName_].put(k, v);
  },

  get([db, k]){
    return databases[db.dbName_].get(k);
  },

  delete([db, k]){
    databases[db.dbName_].delete(k);
  },
}

onmessage = async (e) => {
  if (!moduleInstance) {
    moduleInstance = await Module();
  }

  let messageId = e.data[0];
  let value = handlers[e.data[1]](e.data.slice(2));
  let ok = databases[e.data[2].dbName_].getLastStatus().ok();
  postMessage([messageId, ok, value]);
};
