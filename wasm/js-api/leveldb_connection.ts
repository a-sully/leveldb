import {Module} from "./leveldbwasm";

type PendingPromise = {
  resolve: Function;
  reject: Function;
}

export type WrappedWorkerObj = {
  className: string,
  workerObj: WorkerClass,
}

export type MessageType = {
  messageId?: number;
  wrappedWorkerObj?: WrappedWorkerObj;
  className?: string;
  isStatic: boolean;
  funcName: string;
  args: any[];
}

/* Singleton */
export class WorkerConnection {
  private static instance: WorkerConnection;

  private promises_ = new Map<number, PendingPromise>();
  private nextMessageId: number = 0;

  private worker_: Worker;

  /**
   * The WorkerConnection's constructor should always be private to prevent direct
   * construction calls with the `new` operator.
   */
  private constructor() {
    // Initialize worker
    this.worker_ = new Worker('leveldb_worker.js', {type: 'module'});
    this.worker_.onerror = (event) => {console.log('Worker error ', event);};
    this.worker_.onmessage = (event) => {
      const [messageId, error, result] = event.data;
      const {resolve, reject} = this.promises_.get(messageId);
      this.promises_.delete(messageId);
      if (error)
        reject(error);
      else
        resolve(result);
    };
  }

  /**
   * The static method that controls the access to the singleton instance.
   *
   * This implementation let you subclass the WorkerConnection class while keeping
   * just one instance of each subclass around.
   */
  public static getInstance(): WorkerConnection {
    if (!WorkerConnection.instance) {
      WorkerConnection.instance = new WorkerConnection();
    }

    return WorkerConnection.instance;
  }

  public static shutdown() {
    WorkerConnection.instance = null;
  }

  public getWorker(): Worker {
    return this.worker_;
  }

  private postMessage(message: MessageType) {
    const messageId = ++this.nextMessageId;
    message.messageId = messageId;
    let promise = new Promise((resolve, reject) => {
      this.promises_.set(messageId, {resolve, reject});
      this.worker_.postMessage(message);
    });
    return promise;
  }

  public callWorkerFunction(wrappedWorkerObj: WrappedWorkerObj, funcName: string, args: any[]): Promise<any> {
    return this.postMessage({isStatic: false, wrappedWorkerObj, funcName, args});
  }
  public callStaticWorkerFunction(className: string, funcName: string, args: any[]) {
    return this.postMessage({isStatic: true, className, funcName, args});
  }
}


type ContructorType = {new(...args: any[]): any};

const workerClasses = new Map<string, ContructorType>();
const workerObjects = new Map<number, any>();

function inWorker() {
  return self.hasOwnProperty("WorkerGlobalScope");
}
export class WorkerClass {
  private static nextId_: number = 0;
  private id_ = WorkerClass.nextId_++;
  private static wasmModuleInstance: Module;

  public static setWasmModuleInstance(wasmModuleInstance: Module): void {
    WorkerClass.wasmModuleInstance = wasmModuleInstance;
  }

  public static getWasmModuleInstance(): Module {
    return WorkerClass.wasmModuleInstance;
  }

  public getClassName(): string {
    return this.constructor.name;
  }

  // TODO: Don't return string for error. Throw and catch instead.
  public async ready(): Promise<string | void> { }
}

export function worker_func(waitForReady: boolean = true) {
  return function (_target: any, funcName: string, descriptor: PropertyDescriptor) {
    if (!inWorker()) {
      descriptor.value = async function (...args: any[]) {
        if (waitForReady) {
          await this.ready();
        }
        return await WorkerConnection.getInstance().callWorkerFunction(
          wrapWorkerObj(this),
          funcName,
          args);
      }
    }
  }
}

export function worker_static_func(target: any, funcName: string, descriptor: PropertyDescriptor) {
  if (!inWorker()) {
    descriptor.value = async function (...args: any[]) {
      return await WorkerConnection.getInstance().callStaticWorkerFunction(
        target.name,
        funcName,
        args);
    }
  }
}


export function getWorkerClass(className: string) {
  return workerClasses.get(className);
}

export function worker_class(constructor: ContructorType) {
  if (inWorker()) {
    workerClasses.set(constructor.name, constructor);
  }
}

export function wrapWorkerObj(workerObj: WorkerClass): WrappedWorkerObj {
  return {
    className: workerObj.getClassName(),
    workerObj,
  }
}

export function unwrapWorkerObj({className, workerObj}: WrappedWorkerObj) {
  const workerClass = getWorkerClass(className);
  if (!workerClass) {
    throw new Error(`Worker class '${className}' was not registered on the worker`);
  }

  let typedWorkerObj = workerObjects.get(workerObj['id_']);
  if (!typedWorkerObj) {
    typedWorkerObj = Object.setPrototypeOf(workerObj, workerClass.prototype);
    workerObjects.set(workerObj['id_'], typedWorkerObj);
  }
  return typedWorkerObj;
}