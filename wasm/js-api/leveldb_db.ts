import {Iterator} from './leveldb_iterator.js';
import {
  WorkerClass,
  WrappedWorkerObj,
  worker_class,
  worker_func,
  worker_static_func,
  unwrapWorkerObj,
  wrapWorkerObj
} from './leveldb_connection.js';
import {DbWrapper, Db} from "./leveldbwasm";

let db_create_promise_next_id = 0;
const db_create_promises = new Map<number, Promise<void>>();

@worker_class
export class LevelDb extends WorkerClass {
  private static dbWrapper_: DbWrapper;
  private dbName_: string;
  private db_created_promise_id_: number;
  private isClosed_ = true;
  private iterators_: Iterator[] = [];
  private leveldDb_: Db | undefined;

  public constructor(dbName: string) {
    super();
    this.dbName_ = dbName;
    this.startOpeningDb();
  }

  @worker_static_func
  public static destroy(dbName: string) {
    LevelDb.dbWrapper_.destroy(dbName);
    const status = LevelDb.dbWrapper.getLastStatus();
    const errorString = status.toErrorString();
    if (errorString) {
      throw new Error(errorString);
    }
  }

  private static get dbWrapper() {
    if (!LevelDb.dbWrapper_) {
      LevelDb.dbWrapper_ = new (WorkerClass.getWasmModuleInstance()).DbWrapper();
    }
    return LevelDb.dbWrapper_;
  }

  // Ensures the database is open and ready for use, re-opening the database if
  // it was closed. Class methods operating on the database should call this
  // method before performing any database operations.
  // TODO: Auto-reopening is implemented now for simplicity of the calling code,
  // but this may not be desired behavior. Especially because...
  // TODO: Add better error handling if opening the database fails.
  public async ready(): Promise<string | void> {
    if (this.isClosed_) {
      this.startOpeningDb();
    }
    await this.dbReady();
  }

  private startOpeningDb() {
    this.isClosed_ = false;
    this.db_created_promise_id_ = db_create_promise_next_id;
    db_create_promise_next_id++;
    db_create_promises.set(this.db_created_promise_id_, this.open());
  }

  private throwIfError() {
    const status = this.leveldDb_.getLastStatus();
    const errorString = status.toErrorString();
    if (errorString) {
      throw new Error(errorString);
    }
  }

  @worker_func(false)
  private async open() {
    if (!this.leveldDb_) {
      this.leveldDb_ = LevelDb.dbWrapper.open(this.dbName_);
      this.throwIfError();
    }
  }

  private async dbReady() {
    if (db_create_promises.has(this.db_created_promise_id_)) {
      await db_create_promises.get(this.db_created_promise_id_);
      db_create_promises.delete(this.db_created_promise_id_);
    }
  }

  public getName(): string {
    return this.dbName_;
  }

  @worker_func()
  public async put(k: string, v: string) {
    if (!this.leveldDb_) {
      throw new Error("Database not open");
    }
    this.leveldDb_.put(k, v);
    this.throwIfError();
  }

  @worker_func()
  public async putMany(kvPairs: string[][]) {
    this.leveldDb_.batchStart();
    for (const [k, v] of kvPairs) {
      this.leveldDb_.batchPut(k, v);
      this.throwIfError();
    }
    this.leveldDb_.batchEnd();
  }

  @worker_func()
  public async remove(k: string) {
    this.leveldDb_.remove(k);
    this.throwIfError();
  }

  @worker_func()
  public async get(k: string) {
    const result = this.leveldDb_.get(k);
    this.throwIfError();
    return result;
  }

  @worker_func()
  private async newIteratorImpl(wrappedIter: WrappedWorkerObj) {
    const iter = unwrapWorkerObj(wrappedIter);
    iter.setLevelDbIter(this.leveldDb_.newIterator());

    this.throwIfError();
  }

  public async newIterator() {
    const iterator = new Iterator();

    await this.newIteratorImpl(wrapWorkerObj(iterator));
    this.iterators_.push(iterator);
    return iterator;
  }

  @worker_func(false)
  private async closeImpl() {
    WorkerClass.getWasmModuleInstance().destroy(this.leveldDb_);
    delete this.leveldDb_;
  }

  public async close() {
    if (this.isClosed_) {
      return;
    }

    this.isClosed_ = true;
    const promises: Promise<void>[] = [];
    for (const iterator of this.iterators_) {
      promises.push(iterator.close());
    }
    await Promise.all(promises);

    this.iterators_ = [];

    await this.closeImpl();
  }
}
