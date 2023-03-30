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
      databases[db.dbName_] = new moduleInstance.DbWrapper(db.dbName_);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },

    put(db, k: string, v: string) {
      databases[db.dbName_].put(k, v);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },

    putMany(db, kvPairs: string[][]) {
      for (const [k, v] of kvPairs) {
        const {ok} = handlers.LevelDb.put(db, k, v);
        if (!ok) {
          return {ok};
        }
      }
      return {ok: true};
    },

    get(db, k: string) {
      const result = databases[db.dbName_].get(k);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {result, ok};
    },

    remove(db, k: string) {
      databases[db.dbName_].remove(k);
      const ok = databases[db.dbName_].getLastStatus().ok();
      return {ok};
    },

    newIterator(db) {
      const iterator_id = iterator_next_id;
      iterator_next_id++;

      iterators[iterator_id] = databases[db.dbName_].newIterator();

      return {result: iterator_id, ok: true};
    },
  },
  Iterator: {
    seekToFirst({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.seekToFirst();
      return {
        result: iteratorResult(iterator),
        ok: true,
      }
    },
    seekToLast({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.seekToLast();
      return {
        result: iteratorResult(iterator),
        ok: true,
      }
    },
    seek({iterator_id_}, target: String) {
      const iterator = iterators[iterator_id_];
      iterator.seek(target);
      return {
        result: iteratorResult(iterator),
        ok: true,
      }
    },
    next({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.next();
      return {
        result: iteratorResult(iterator),
        ok: true,
      }
    },
    prev({iterator_id_}) {
      const iterator = iterators[iterator_id_];
      iterator.prev();
      return {
        result: iteratorResult(iterator),
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
