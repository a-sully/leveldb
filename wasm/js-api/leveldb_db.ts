import {LevelDbConnection} from './leveldb_connection.js';
import {Iterator} from './leveldb_iterator.js';

let db_create_promise_next_id = 0;
const db_create_promises = {};

export class LevelDb {
  private CLASS_NAME: string = this.constructor.name;
  private static nextId: number = 0;
  private id_: number;
  private dbName_: string;
  private db_created_promise_id_;

  public constructor(dbName: string) {
    this.id_ = ++LevelDb.nextId;
    this.dbName_ = dbName;
    this.db_created_promise_id_ = db_create_promise_next_id;
    db_create_promise_next_id++;
    db_create_promises[db_create_promise_next_id] = LevelDbConnection.getInstance().postMessage(this, 'open');
  }

  private async dbReady() {
    if (db_create_promises.hasOwnProperty(this.db_created_promise_id_)) {
      await db_create_promises[this.db_created_promise_id_];
      delete db_create_promises[this.db_created_promise_id_];
    }
  }

  public getName(): string {
    return this.dbName_;
  }

  public async put(k: string, v: string) {
    await this.dbReady();
    await LevelDbConnection.getInstance().postMessage(this, 'put', k, v);
  }

  public async putMany(kvPairs: string[][]) {
    await this.dbReady();
    await LevelDbConnection.getInstance().postMessage(this, 'putMany', kvPairs);
  }

  public async remove(k: string) {
    await this.dbReady();
    await LevelDbConnection.getInstance().postMessage(this, 'remove', k);
  }

  public async get(k: string) {
    await this.dbReady();
    return await LevelDbConnection.getInstance().postMessage(this, 'get', k);
  }

  public async newIterator() {
    await this.dbReady();
    return new Iterator(await LevelDbConnection.getInstance().postMessage(this, 'newIterator'));
  }
}
