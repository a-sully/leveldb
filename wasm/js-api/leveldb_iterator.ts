import {LevelDbConnection} from './leveldb_connection.js';

export class Iterator {
  private CLASS_NAME: string = this.constructor.name;
  private iterator_id_: number;

  valid: boolean;
  key: string | undefined;
  value: string | undefined;

  public constructor(iterator_id: number) {
    this.iterator_id_ = iterator_id;
  }

  private async postMessage(message, ...args) {
    ({valid: this.valid, key: this.key, value: this.value} =
      await LevelDbConnection.getInstance().postMessage(this, message, ...args));
  }

  seekToFirst(): Promise<void> {
    return this.postMessage('seekToFirst');
  }

  seekToLast(): Promise<void> {
    return this.postMessage('seekToLast');
  }

  seek(target: String): Promise<void> {
    return this.postMessage('seek', target)
  }

  next(): Promise<void> {
    return this.postMessage('next');
  }

  prev(): Promise<void> {
    return this.postMessage('prev');
  }
}
