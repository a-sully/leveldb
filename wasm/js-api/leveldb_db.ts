/* Singleton */
class LevelDbConnection {
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
      this.worker_ = new Worker('leveldb_worker.js', { type: 'module' });
      this.worker_.onerror = (event) => { console.log('Worker error ', event); };
      this.worker_.onmessage = (event) => {
        let messageId = event.data[0];
        if (event.data[1])
          this.promises_[messageId].resolve(event.data[2]);
        else
          this.promises_[messageId].reject('Status not ok');
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

    public getWorker() : Worker {
      return this.worker_;
    }

    public postMessage(arr) : Promise<any> {
      let messageId = ++this.nextMessageId;
      arr.unshift(messageId);
      let promise = new Promise((resolve, reject) => {
        this.promises_[messageId] = {};
        this.promises_[messageId].resolve = resolve;
        this.promises_[messageId].reject = reject;
        this.worker_.postMessage(arr);
      });
      return promise;
    }
}

export class LevelDb {
    private static nextId: number = 0;
    private id_: number;
    private dbName_: String;

    public constructor(dbName: String) {
      this.id_ = ++LevelDb.nextId;
      this.dbName_ = dbName;

      LevelDbConnection.getInstance().postMessage(['open', this]);
    }

    public put(k: String, v: String) {
      return LevelDbConnection.getInstance().postMessage(['put', this, k, v]);
    }

    public get(k: String) {
      return LevelDbConnection.getInstance().postMessage(['get', this, k]);
    }
}
