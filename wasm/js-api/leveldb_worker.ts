import moduleInstanceConstructor from "./leveldbwasm.js";
import { Module, Iterator, DbWrapper } from "./leveldbwasm";

type WorkerResponse = {
  result?: any,
  errorString: string | null;
}

const databases = new Map<string, DbWrapper>();
let iterator_next_id = 0;
const iterators = new Map<number, Iterator>();
let moduleInstance: Module = undefined;

function iteratorResult(iterator: Iterator) {
  const valid = iterator.valid();
  return {
    valid,
    key: valid ? iterator.key() : undefined,
    value: valid ? iterator.value() : undefined,
  }
}

const handlers: { [key: string]: { [key: string]: (...args: any[]) => WorkerResponse } } = {
  LevelDb: {
    open(dbName: string): WorkerResponse {
      let database = databases.get(dbName);
      if (!database) {
        database = new moduleInstance.DbWrapper(dbName);
        databases.set(dbName, database);
      }
      let status = database.getLastStatus();
      return {errorString: status.toErrorString()};
    },

    close(dbName: string): WorkerResponse {
      const database = databases.get(dbName);
      if (database) {
        database.close();
        databases.delete(dbName);
      }
      return { errorString: null }
    },

    put(dbName: string, k: string, v: string): WorkerResponse {
      const database = databases.get(dbName);
      database.put(k, v);
      let status = database.getLastStatus();
      return {errorString: status.toErrorString()};
    },

    putMany(dbName: string, kvPairs: string[][]): WorkerResponse {
      const database = databases.get(dbName);
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

    get(dbName: string, k: string): WorkerResponse {
      const database = databases.get(dbName);
      const result = database.get(k);
      let status = database.getLastStatus();
      return {result, errorString: status.toErrorString()};
    },

    remove(dbName: string, k: string): WorkerResponse {
      const database = databases.get(dbName);
      database.remove(k);
      let status = database.getLastStatus();
      return {errorString: status.toErrorString()};
    },

    newIterator(dbName: string): WorkerResponse {
      const iterator_id = iterator_next_id;
      iterator_next_id++;

      const database = databases.get(dbName);
      iterators.set(iterator_id, database.newIterator());

      return {result: iterator_id, errorString: null};
    },
  },
  Iterator: {
    seekToFirst(iteratorId: number): WorkerResponse {
      const iterator = iterators.get(iteratorId);
      iterator.seekToFirst();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    seekToLast(iteratorId: number): WorkerResponse {
      const iterator = iterators.get(iteratorId);
      iterator.seekToLast();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    seek(iteratorId: number, target: string): WorkerResponse {
      const iterator = iterators.get(iteratorId);
      iterator.seek(target);
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    next(iteratorId: number): WorkerResponse {
      const iterator = iterators.get(iteratorId);
      iterator.next();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    prev(iteratorId: number): WorkerResponse {
      const iterator = iterators.get(iteratorId);
      iterator.prev();
      return {
        result: iteratorResult(iterator),
        errorString: null,
      }
    },
    close(iteratorId: number): WorkerResponse {
      const iterator = iterators.get(iteratorId);

      if (iterator != undefined) {
        iterator.close();
      }
      iterators.delete(iteratorId);
      return {
        errorString: null,
      }
    },
  }
}

onmessage = async (e) => {
  if (!moduleInstance) {
    moduleInstance = await moduleInstanceConstructor();
  }

  if (e.data.length < 3) {
    throw new Error("Message must contain messageId, targetObj, and messageName");
  }

  const [messageId, targetObj, className, messageName, ...args]: [number, string | number, string, string, ...any] = e.data;

  const handler: ((...args: any[]) => WorkerResponse) = handlers[className][messageName]
  const {result, errorString} = handler(targetObj, ...args);
  postMessage([messageId, errorString, result]);
};
