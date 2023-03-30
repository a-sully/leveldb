// When editing this file it must be kept in sync with interface.idl.

export interface Status {
    status(): void;
    ok(): boolean;
    toErrorString(): string;
}

export interface Iterator {
    valid(): boolean;
    seekToFirst(): void;
    seekToLast(): void;
    seek(target: string): void;
    key(): string;
    value(): string;
    next(): void;
    prev(): void;
    status(): Status;
    close(): void;
}

export interface DbWrapper {
    new (name: string): DbWrapper;
    put(k: string, v: string): void;
    batchStart(): void;
    batchEnd(): void;
    batchPut(k: string, v: string): void;
    remove(k: string): void;
    get(k: string): string;
    newIterator(): Iterator;
    getLastStatus(): Status;
    close(): void;
}

export type Module = {
  DbWrapper: new (name: string) => DbWrapper;
};

declare let ModuleInstanceConstructor: () => Promise<Module>;
export default ModuleInstanceConstructor;