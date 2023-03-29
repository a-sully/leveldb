import Module from "./leveldbwasm.js"

const databases = {};
let iterator_next_id = 0;
const iterators = {};
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

    remove(db, k: String) {
      databases[db.dbName_].remove(k);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },

    newIterator(db) {
      const iterator_id = iterator_next_id;
      iterator_next_id++;

      iterators[iterator_id] = databases[db.dbName_].newIterator();

      return {result: iterator_id, ok: true};
    }
  },
  Iterator: {
    valid({iterator_id_}) {
      return {
        result: iterators[iterator_id_].valid(),
        ok: true,
      }
    },
    seekToFirst({iterator_id_}) {
      iterators[iterator_id_].seekToFirst();
      return {
        ok: true,
      }
    },
    key({iterator_id_}) {
      return {
        result: iterators[iterator_id_].key(),
        ok: true,
      }
    },
    value({iterator_id_}) {
      return {
        result: iterators[iterator_id_].value(),
        ok: true,
      }
    },
    next({iterator_id_}) {
      iterators[iterator_id_].next();
      return {
        ok: true,
      }
    },
    prev({iterator_id_}) {
      iterators[iterator_id_].prev();
      return {
        ok: true,
      }
    },
    status({iterator_id_}) {
      return {
        result: iterators[iterator_id_].valid(),
        ok: true,
      }
    },
  }
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
