import Module from "./leveldbwasm.js"

const databases = {};
let iterator_next_id = 0;
const iterators = {};
let moduleInstance = undefined;

function iteratorResult(iterator) {
  const valid = iterator.valid();
  return {
    valid,
    key: valid ? iterator.key() : undefined,
    value: valid ? iterator.value() : undefined,
  }
}

const handlers = {
  LevelDb: {
    open(db) {
      if (databases[db.dbName_] == undefined) {
        databases[db.dbName_] = new moduleInstance.DbWrapper(db.dbName_);
      }
      let status = databases[db.dbName_].getLastStatus();
      return {errorString: status.toErrorString()};
    },

    close(db) {
      if (databases[db.dbName_] != undefined) {
        databases[db.dbName_].close();
        databases[db.dbName_] = undefined;
      }
      return { ok: true }
    },

    put(db, k: string, v: string) {
      databases[db.dbName_].put(k, v);
      let status = databases[db.dbName_].getLastStatus();
      return {errorString: status.toErrorString()};
    },

    putMany(db, kvPairs: string[][]) {
      const database = databases[db.dbName_];
      database.batchStart();
      for (const [k, v] of kvPairs) {
        database.batchPut(k, v);
        const errorString = database.getLastStatus().toErrorString();
        if (errorString) {
          return {errorString};
        }
      }
      database.batchEnd();
      return {errorString: null};
    },

    get(db, k: string) {
      const result = databases[db.dbName_].get(k);
      let status = databases[db.dbName_].getLastStatus();
      return {result, errorString: status.toErrorString()};
    },

    remove(db, k: string) {
      databases[db.dbName_].remove(k);
      let status = databases[db.dbName_].getLastStatus();
      return {errorString: status.toErrorString()};
    },

    newIterator(db) {
      const iterator_id = iterator_next_id;
      iterator_next_id++;

      iterators[iterator_id] = databases[db.dbName_].newIterator();

      return {result: iterator_id, errorString: null};
    },
  },
  Iterator: {
    seekToFirst({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.seekToFirst();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    seekToLast({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.seekToLast();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    seek({iterator_id_}, target: String) {
      const iterator = iterators[iterator_id_];
      iterator.seek(target);
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    next({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.next();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    prev({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.prev();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    close({iterator_id_}) {
      const iterator = iterators[iterator_id_];

      if (iterator != undefined) {
        iterator.close();
      }
      iterators[iterator_id_] = undefined;
      return {
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

  const {result, errorString} = handlers[targetObj.CLASS_NAME][messageName](targetObj, ...args);
  postMessage([messageId, errorString, result]);
};
