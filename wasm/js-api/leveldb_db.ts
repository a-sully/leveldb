import {Iterator} from './leveldb_iterator.js';
import {LevelDbConnection} from './leveldb_connection.js';

let db_create_promise_next_id = 0;
const db_create_promises = new Map<number, Promise<void>>();

export class LevelDb {
  private CLASS_NAME: string = this.constructor.name;
  private static nextId: number = 0;
  private id_: number;
  private dbName_: string;
  private db_created_promise_id_: number;
  private isClosed_ = true;
  private iterators_: Iterator[] = [];

  public constructor(dbName: string) {
    this.id_ = ++LevelDb.nextId;
    this.dbName_ = dbName;
    this.startOpeningDb();
  }

  public static destroy(dbName: string) {
    return LevelDbConnection.getInstance().postMessage(dbName, 'LevelDb', 'destroy');
  }

  // Ensures the database is open and ready for use, re-opening the database if
  // it was closed. Class methods operating on the database should call this
  // method before performing any database operations.
  // TODO: Auto-reopening is implemented now for simplicity of the calling code,
  // but this may not be desired behavior. Especially because...
  // TODO: Add better error handling if opening the database fails.
  private async dbOpenAndReady() {
    if (this.isClosed_) {
      this.startOpeningDb();
    }
    await this.dbReady();
  }

  postMessage(method: string, ...args: any[]) {
    return LevelDbConnection.getInstance().postMessage(this.dbName_, 'LevelDb', method, ...args);
  }

  private startOpeningDb() {
    this.isClosed_ = false;
    this.db_created_promise_id_ = db_create_promise_next_id;
    db_create_promise_next_id++;
    db_create_promises.set(db_create_promise_next_id, this.postMessage('open'));
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

  public async put(k: string, v: string) {
    await this.dbOpenAndReady();
    await this.postMessage('put', k, v);
  }

  public async putMany(kvPairs: string[][]) {
    await this.dbOpenAndReady();
    await this.postMessage('putMany', kvPairs);
  }

  public async remove(k: string) {
    await this.dbOpenAndReady();
    await this.postMessage('remove', k);
  }

  public async get(k: string) {
    await this.dbOpenAndReady();
    return await this.postMessage('get', k);
  }

  public async newIterator() {
    await this.dbOpenAndReady();
    let iterator = new Iterator(await this.postMessage('newIterator'));
    this.iterators_.push(iterator);
    return iterator;
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

    await this.postMessage('close');
  }
}
