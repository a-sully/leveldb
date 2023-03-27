

/* Singleton */
class LevelDbConnection {
    private static instance: LevelDbConnection;

    private worker_: Worker;

    /**
     * The LevelDbConnection's constructor should always be private to prevent direct
     * construction calls with the `new` operator.
     */
    private constructor() {
      // Initialize worker
      this.worker_ = new Worker('leveldb_worker.js');
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
}

export class LevelDb {
    private static nextId: number = 0;
    private id_: number;
    private dbName_: String;

    public constructor(dbName: String) {
      this.id_ = ++LevelDb.nextId;
      this.dbName_ = dbName;

      LevelDbConnection.getInstance().getWorker().postMessage(['open', this]);
    }

    public put(k: String, v: String) {
      LevelDbConnection.getInstance().getWorker().postMessage(['put', this, k, v]);
    }

    public getName(): String {
      return this.dbName_;
    }
}
