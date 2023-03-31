import moduleInstanceConstructor from "./leveldbwasm.js";

import {getWorkerClass, MessageType, unwrapWorkerObj, WorkerClass} from "./leveldb_connection.js";
import {LevelDb} from './leveldb_db.js';
import {Iterator} from './leveldb_iterator.js';
{
  // Needed so typescript compiler doesn't throw away imports.
  LevelDb;
  Iterator;
}


let setWasmModuleInstance: boolean = false;

onmessage = async (e) => {
  if (!setWasmModuleInstance) {
    setWasmModuleInstance = true;
    WorkerClass.setWasmModuleInstance(await moduleInstanceConstructor());
  }

  const {messageId, wrappedWorkerObj, className, isStatic, funcName, args}: MessageType = e.data;

  let workerObj: any;
  if (isStatic) {
    if (!className) {
      throw new Error("Must pass className for static functions.");
    }
    workerObj = getWorkerClass(className);
  } else {
    if (!wrappedWorkerObj) {
      throw new Error("Must pass wrappedWorkerObj for method functions.");
    }
    workerObj = unwrapWorkerObj(wrappedWorkerObj);
  }

  let error: any;
  let result: any;
  try {
    result = await workerObj[funcName](...args);
  } catch (e: any) {
    error = e;
  }
  postMessage([messageId, error, result]);
};
