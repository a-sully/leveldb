import { Iterator } from "./leveldb_iterator";
import { LevelDb } from "./leveldb_db";

type PendingPromise = {
  resolve: Function;
  reject: Function;
} 

/* Singleton */
export class LevelDbConnection {
  private static instance: LevelDbConnection;

  private promises_ = new Map<number, PendingPromise>();
  private nextMessageId: number = 0;

  private worker_: Worker;

  /**
   * The LevelDbConnection's constructor should always be private to prevent direct
   * construction calls with the `new` operator.
   */
  private constructor() {
    // Initialize worker
    this.worker_ = new Worker('leveldb_worker.js', {type: 'module'});
    this.worker_.onerror = (event) => {console.log('Worker error ', event);};
    this.worker_.onmessage = (event) => {
      const [messageId, errorString, result] = event.data;
      const {resolve, reject} = this.promises_.get(messageId);
      this.promises_.delete(messageId);
      if (errorString)
        reject('Status not ok: ' + errorString);
      else
        resolve(result);
    };
  }

  /**
   * The static method that controls the access to the singleton instance.
   *
   * This implementation let you subclass the LevelDbConnection class while keeping
   * just one instance of each subclass around.
   */
  public static getInstance(): LevelDbConnection {
    if (!LevelDbConnection.instance) {
      LevelDbConnection.instance = new LevelDbConnection();
    }

    return LevelDbConnection.instance;
  }

  public static shutdown() {
    LevelDbConnection.instance = null;
  }

  public getWorker(): Worker {
    return this.worker_;
  }

  public postMessage(targetObj: string | number, klass: string, method: string, ...args: any[]): Promise<any> {
    const messageId = ++this.nextMessageId;
    let promise = new Promise((resolve, reject) => {
      this.promises_.set(messageId, {resolve, reject});
      this.worker_.postMessage([messageId, targetObj, klass, method, ...args]);
    });
    return promise;
  }
}
