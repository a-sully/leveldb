import Module from "./leveldbwasm.js"

const databases = {}
let moduleInstance = undefined;

const handlers = {
  LevelDb: {
    open(db) {
      databases[db.dbName_] = new moduleInstance.DbWrapper(db.dbName_);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },

    put(db, k: String, v: String) {
      databases[db.dbName_].put(k, v);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },

    get(db, k: String) {
      const result = databases[db.dbName_].get(k);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {result, ok};
    },

    delete(db, k: String) {
      databases[db.dbName_].delete(k);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },
  },
}

onmessage = async (e) => {
  if (!moduleInstance) {
    moduleInstance = await Module();
  }

  if (e.data.length < 3) {
    throw new Error("Message must contain messageId, targetObj, and messageName");
  }

  const [messageId, targetObj, messageName, ...args] = e.data;

  const {result, ok} = handlers[targetObj.CLASS_NAME][messageName](targetObj, ...args);
  postMessage([messageId, ok, result]);
};
