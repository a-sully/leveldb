import {LevelDbConnection} from './leveldb_connection.js';
import {Iterator} from './leveldb_iterator.js';

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

  public async newIterator() {
    return new Iterator(await LevelDbConnection.getInstance().postMessage(this, 'newIterator'));
  }
}
