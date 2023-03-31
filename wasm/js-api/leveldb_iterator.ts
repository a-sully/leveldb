import {WorkerClass, worker_class, worker_func} from './leveldb_connection.js';
import {Iterator as LevelDbIterator} from "./leveldbwasm";

type IteratorResult = {
  valid: boolean;
  key: string;
  value: string;
}

@worker_class
export class Iterator extends WorkerClass {
  private levelDbIter_: LevelDbIterator | undefined;

  valid: boolean = false;
  closed: boolean = false;
  key: string | undefined = undefined;
  value: string | undefined = undefined;

  public async ready(): Promise<string | void> {
    if (this.closed) {
      throw new Error("DB for iterator closed");
    }
  }

  public setLevelDbIter(levelDbIter: LevelDbIterator) {
    this.levelDbIter_ = levelDbIter;
  }

  private iteratorResult(): IteratorResult {
    const valid = this.levelDbIter_.valid();
    return {
      valid,
      key: valid ? this.levelDbIter_.key() : undefined,
      value: valid ? this.levelDbIter_.value() : undefined,
    }
  }

  private cacheIteratorResult(iteratorResult: IteratorResult): void {
    const {valid, key, value} = iteratorResult;
    this.valid = valid;
    this.key = key;
    this.value = value;
  }

  @worker_func()
  private async seekToFirstImpl(): Promise<IteratorResult> {
    this.levelDbIter_.seekToFirst();
    return this.iteratorResult();
  }

  public async seekToFirst(): Promise<void> {
    this.cacheIteratorResult(await this.seekToFirstImpl());
  }

  @worker_func()
  private async seekToLastImpl(): Promise<IteratorResult> {
    this.levelDbIter_.seekToLast();
    return this.iteratorResult();
  }

  public async seekToLast(): Promise<void> {
    this.cacheIteratorResult(await this.seekToLastImpl());
  }

  @worker_func()
  private async seekImpl(target: string): Promise<IteratorResult> {
    this.levelDbIter_.seek(target);
    return this.iteratorResult();
  }

  public async seek(target: string): Promise<void> {
    this.cacheIteratorResult(await this.seekImpl(target));
  }

  @worker_func()
  private async nextImpl(): Promise<IteratorResult> {
    this.levelDbIter_.next();
    return this.iteratorResult();
  }

  public async next(): Promise<void> {
    this.cacheIteratorResult(await this.nextImpl());
  }

  @worker_func()
  private async prevImpl(): Promise<IteratorResult> {
    this.levelDbIter_.prev();
    return this.iteratorResult();
  }

  public async prev(): Promise<void> {
    this.cacheIteratorResult(await this.prevImpl());
  }

  @worker_func()
  private async closeImpl(): Promise<void> {
    WorkerClass.getWasmModuleInstance().destroy(this.levelDbIter_);
    delete this.levelDbIter_;
  }

  async close(): Promise<void> {
    await this.closeImpl();
    this.valid = false;
    this.closed = true;
    this.key = undefined;
    this.value = undefined;
  }
}
