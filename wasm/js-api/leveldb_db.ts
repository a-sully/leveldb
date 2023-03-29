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
      this.worker_ = new Worker('leveldb_worker.js', {type: 'module'});
      this.worker_.onerror = (event) => {console.log('Worker error ', event);};
      this.worker_.onmessage = (event) => {
        let [messageId, success, result] = event.data;
        if (success)
          this.promises_[messageId].resolve(result);
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

    public postMessage(db: LevelDb, message: string, ...args): Promise<any> {
      const messageId = ++this.nextMessageId;
      let promise = new Promise((resolve, reject) => {
        this.promises_[messageId] = {resolve, reject};
        this.worker_.postMessage([messageId, db, message, ...args]);
      });
      return promise;
    }
}

export class LevelDb {
    private CLASS_NAME: string = this.constructor.name;
    private static nextId: number = 0;
    private id_: number;
    private dbName_: string;

    public constructor(dbName: string) {
      this.id_ = ++LevelDb.nextId;
      this.dbName_ = dbName;

      LevelDbConnection.getInstance().postMessage(this, 'open');
    }

    public getName(): string {
      return this.dbName_;
    }

    public put(k: string, v: string) {
      return LevelDbConnection.getInstance().postMessage(this, 'put', k, v);
    }

    public get(k: string) {
      return LevelDbConnection.getInstance().postMessage(this, 'get', k);
    }
}
