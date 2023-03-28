import Module from "./leveldbwasm.js"

let databases = {}
let moduleInstance = undefined;

const handlers = {
  open([db]){
    databases[db.dbName_] = new moduleInstance.DbWrapper(db.dbName_);
  },

  put([db, k, v]){
    databases[db.dbName_].put(k, v);
  }
}

onmessage = async (e) => {
  if (!moduleInstance) {
    moduleInstance = await Module();
  }

  handlers[e.data[0]](e.data.slice(1));
};
