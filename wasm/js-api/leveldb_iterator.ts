import {LevelDbConnection} from './leveldb_connection.js';

export class Iterator {
  private CLASS_NAME: string = this.constructor.name;
  private iterator_id_: number;

  public constructor(iterator_id: number) {
    this.iterator_id_ = iterator_id;
  }

  valid(): Promise<boolean> {
    return LevelDbConnection.getInstance().postMessage(this, 'valid');
  }

  seekToFirst(): Promise<void> {
    return LevelDbConnection.getInstance().postMessage(this, 'seekToFirst');
  }

  seekToLast(): Promise<void> {
    return LevelDbConnection.getInstance().postMessage(this, 'seekToLast');
  }

  seek(target: String): Promise<void> {
    return LevelDbConnection.getInstance().postMessage(this, 'seek', target)
  }

  key(): Promise<string> {
    return LevelDbConnection.getInstance().postMessage(this, 'key');
  }

  value(): Promise<string> {
    return LevelDbConnection.getInstance().postMessage(this, 'value');
  }

  next(): Promise<void> {
    return LevelDbConnection.getInstance().postMessage(this, 'next');
  }

  prev(): Promise<void> {
    return LevelDbConnection.getInstance().postMessage(this, 'prev');
  }

  status() {
    return LevelDbConnection.getInstance().postMessage(this, 'status');
  }

}
