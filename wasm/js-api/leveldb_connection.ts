/* Singleton */
export class LevelDbConnection {
  private static instance: LevelDbConnection;

  private promises_ = {};
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
      let [messageId, errorString, result] = event.data;
      if (errorString)
        this.promises_[messageId].reject('Status not ok: ' + errorString);
      else
        this.promises_[messageId].resolve(result);
      delete this.promises_[messageId];
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

  public postMessage(targetObj, message: string, ...args): Promise<any> {
    const messageId = ++this.nextMessageId;
    let promise = new Promise((resolve, reject) => {
      this.promises_[messageId] = {resolve, reject};
      this.worker_.postMessage([messageId, targetObj, message, ...args]);
    });
    return promise;
  }
}
