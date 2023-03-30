import {LevelDbConnection} from './leveldb_connection.js';

export class Iterator {
  private CLASS_NAME: string = this.constructor.name;
  private iterator_id_: number;

  valid: boolean = false;
  closed: boolean = false;
  key: string | undefined= undefined;
  value: string | undefined = undefined;

  public constructor(iterator_id: number) {
    this.iterator_id_ = iterator_id;
  }

  private async postMessage(message, ...args) {
    ({valid: this.valid, key: this.key, value: this.value} =
      await LevelDbConnection.getInstance().postMessage(this, message, ...args));
  }

  seekToFirst(): Promise<void> {
    if (this.closed) return Promise.reject();
    return this.postMessage('seekToFirst');
  }

  seekToLast(): Promise<void> {
    if (this.closed) return Promise.reject();
    return this.postMessage('seekToLast');
  }

  seek(target: String): Promise<void> {
    if (this.closed) return Promise.reject();
    return this.postMessage('seek', target)
  }

  next(): Promise<void> {
    if (this.closed) return Promise.reject();
    return this.postMessage('next');
  }

  prev(): Promise<void> {
    if (this.closed) return Promise.reject();
    return this.postMessage('prev');
  }

  close(): Promise<void> {
    if (this.closed) return Promise.reject();
    this.valid = false;
    this.closed = true;
    this.key = undefined;
    this.value = undefined;
    return LevelDbConnection.getInstance().postMessage(this, 'close');
  }
}
