This project builds [LevelDb](https://github.com/google/leveldb) as a [Wasm](https://webassembly.org/) library to give sites direct access to a performant device-local key/value store.

[Emscripten](https://emscripten.org/index.html) is used to compile C++ to Web Assembly.

The data is stored via the site's [Origin Private File System](https://developer.chrome.com/articles/origin-private-file-system/).

## Status

**The project should be considered a POC** or example of how to build a Wasm library.

  * A limited set of LevelDb operations are thus far provided (e.g. no `WriteOptions`).
  * Few performance optimizations have been pursued.
  * Test coverage is minimal.

# Building

## Set up CMake

    $ sudo apt install cmake

## Get and build the code

    $ git clone --recurse-submodules git@github.com:a-sully/leveldb.git
    $ cd leveldb

## Set up the Emscripten SDK
    $ cd third_party/emsdk
    $ ./emsdk install latest
    $ ./emsdk activate latest
    $ source ./emsdk_env.sh

## Set up a CMake build directory
    $ cd ../..
    $ mkdir -p build && cd build
    $ emcmake cmake -DCMAKE_BUILD_TYPE=Release ..

## Build
    $ cmake --build . --target leveldbwasmdemo

> Tip: set `CMAKE_BUILD_PARALLEL_LEVEL` or use `-jN` to build faster.

# Run

## Setting up a local web server

Using threads in WASM requires SharedArrayBuffer, which is only enabled when a page is cross-origin isolated, which requires adding the following headers to all HTTP responses:

    Cross-Origin-Embedder-Policy: require-corp
    Cross-Origin-Opener-Policy: same-origin

The usual local development servers such as the one built into Python don’t send these headers. One built with Rust however, called [sfz](https://github.com/weihanglo/sfz) provides a --coi option to enable the necessary headers.

## Demo

Build the `leveldbwasmdemo` target and direct your browser to `demo.html` on your local server, e.g. `http://localhost:5000/demo.html`.

## Benchmark

Build the `leveldbwasmbench` target and direct your browser to `benchmark.html` on your local server, e.g. `http://localhost:5000/benchmark.html`.

This compares the speed of LevelDB via Wasm to IndexedDB (wrapped with [IDB-Keyval](https://github.com/jakearchibald/idb-keyval)) for some simple key/value store operations, mainly `put`, `get` and `delete`. DevTools should be able to show additional metrics such as local storage space used (in Chromium this is found under the `Application` tab).

## Develop

The public-facing API is published in `./wasm/js-api/`. Some code for interfacing between ES and C++ resides in `./wasm/idl/`. For usage examples, refer to the demo and benchmark apps 


### Authors

* Reilly Grant (reillyg@google.com)
* Nathan Memmot (memmott@google.com)
* Evan Stade (estade@google.com)
* Austin Sullivan (asully@google.com)

# References

* [LevelDb](https://github.com/google/leveldb) 
* [Emscripten](https://emscripten.org/docs/porting/pthreads.html)
* [WebIDL Binder](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/WebIDL-Binder.html)
* [WasmFS](https://emscripten.org/docs/api_reference/Filesystem-API#new-file-system-wasmfs)
* [C/C++ debugging extension](https://chromewebstore.google.com/detail/pdcpmagijalfljmkmjngeonclgbbannb)
* [https://developer.chrome.com/articles/origin-private-file-system/](Origin Private File System)
* [OPFS explorer extension](https://chrome.google.com/webstore/detail/opfs-explorer/acndjpgkpaclldomagafnognkcgjignd)
* [sfz](https://github.com/weihanglo/sfz)
* [IDB-Keyval](https://github.com/jakearchibald/idb-keyval)
* [Previous porting effort](https://github.com/fivedots/leveldb-wasm)
