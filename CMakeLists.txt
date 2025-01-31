# Copyright 2017 The LevelDB Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file. See the AUTHORS file for names of contributors.

cmake_minimum_required(VERSION 3.9)
# Keep the version below in sync with the one in db.h
project(leveldb VERSION 1.23.0 LANGUAGES C CXX)

# C standard can be overridden when this is used as a sub-project.
if(NOT CMAKE_C_STANDARD)
  # This project can use C11, but will gracefully decay down to C89.
  set(CMAKE_C_STANDARD 11)
  set(CMAKE_C_STANDARD_REQUIRED OFF)
  set(CMAKE_C_EXTENSIONS OFF)
endif(NOT CMAKE_C_STANDARD)

# C++ standard can be overridden when this is used as a sub-project.
if(NOT CMAKE_CXX_STANDARD)
  # This project requires C++11.
  set(CMAKE_CXX_STANDARD 11)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  set(CMAKE_CXX_EXTENSIONS OFF)
endif(NOT CMAKE_CXX_STANDARD)

if (WIN32)
  set(LEVELDB_PLATFORM_NAME LEVELDB_PLATFORM_WINDOWS)
  # TODO(cmumford): Make UNICODE configurable for Windows.
  add_definitions(-D_UNICODE -DUNICODE)
else (WIN32)
  set(LEVELDB_PLATFORM_NAME LEVELDB_PLATFORM_POSIX)
endif (WIN32)

option(LEVELDB_BUILD_TESTS "Build LevelDB's unit tests" ON)
option(LEVELDB_BUILD_BENCHMARKS "Build LevelDB's benchmarks" ON)
option(LEVELDB_INSTALL "Install LevelDB's header and library" ON)

include(CheckIncludeFile)
check_include_file("unistd.h" HAVE_UNISTD_H)

include(CheckLibraryExists)
check_library_exists(crc32c crc32c_value "" HAVE_CRC32C)
check_library_exists(snappy snappy_compress "" HAVE_SNAPPY)
check_library_exists(zstd zstd_compress "" HAVE_ZSTD)
check_library_exists(tcmalloc malloc "" HAVE_TCMALLOC)

include(CheckCXXSymbolExists)
# Using check_cxx_symbol_exists() instead of check_c_symbol_exists() because
# we're including the header from C++, and feature detection should use the same
# compiler language that the project will use later. Principles aside, some
# versions of do not expose fdatasync() in <unistd.h> in standard C mode
# (-std=c11), but do expose the function in standard C++ mode (-std=c++11).
check_cxx_symbol_exists(fdatasync "unistd.h" HAVE_FDATASYNC)
check_cxx_symbol_exists(F_FULLFSYNC "fcntl.h" HAVE_FULLFSYNC)
check_cxx_symbol_exists(O_CLOEXEC "fcntl.h" HAVE_O_CLOEXEC)

if(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
  # Disable C++ exceptions.
  string(REGEX REPLACE "/EH[a-z]+" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /EHs-c-")
  add_definitions(-D_HAS_EXCEPTIONS=0)

  # Disable RTTI.
  string(REGEX REPLACE "/GR" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} /GR-")
else(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
  # Enable strict prototype warnings for C code in clang and gcc.
  if(NOT CMAKE_C_FLAGS MATCHES "-Wstrict-prototypes")
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -Wstrict-prototypes")
  endif(NOT CMAKE_C_FLAGS MATCHES "-Wstrict-prototypes")

  # Disable RTTI.
  string(REGEX REPLACE "-frtti" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-rtti")
endif(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")

if (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
  # Create HTML executables for WASM to run from a browser.
  #set(CMAKE_EXECUTABLE_SUFFIX ".html")

  # Enable pthreads.
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -pthread")

  # Enable debug information.
if (CMAKE_SYSTEM_NAME STREQUAL "Debug")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -gsource-map")
  set(WASM_DEBUG_FLAGS -sASSERTIONS --source-map-base=http://localhost:5000/build/)
endif(CMAKE_SYSTEM_NAME STREQUAL "Debug")

  # Enable the OPFS by using WasmFS in a worker.
  set(WASM_FLAGS -sALLOW_MEMORY_GROWTH -sWASMFS -sPROXY_TO_PTHREAD)

  # Use PRIVATE link options to use these flags on specific executables, rather
  # than globally, where they would be unused in third_party targets.
  set(PRIVATE_TARGET_LINK_OPTIONS ${WASM_FLAGS} ${WASM_DEBUG_FLAGS})
else (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
  # Disable C++ exceptions.
  string(REGEX REPLACE "-fexceptions" "" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-exceptions")
endif(CMAKE_SYSTEM_NAME STREQUAL Emscripten)

# Test whether -Wthread-safety is available. See
# https://clang.llvm.org/docs/ThreadSafetyAnalysis.html
include(CheckCXXCompilerFlag)
check_cxx_compiler_flag(-Wthread-safety HAVE_CLANG_THREAD_SAFETY)

# Used by googletest.
check_cxx_compiler_flag(-Wno-missing-field-initializers
                        LEVELDB_HAVE_NO_MISSING_FIELD_INITIALIZERS)

include(CheckCXXSourceCompiles)

# Test whether C++17 __has_include is available.
check_cxx_source_compiles("
#if defined(__has_include) &&  __has_include(<string>)
#include <string>
#endif
int main() { std::string str; return 0; }
" HAVE_CXX17_HAS_INCLUDE)

set(LEVELDB_PUBLIC_INCLUDE_DIR "include/leveldb")
set(LEVELDB_PORT_CONFIG_DIR "include/port")

configure_file(
  "port/port_config.h.in"
  "${PROJECT_BINARY_DIR}/${LEVELDB_PORT_CONFIG_DIR}/port_config.h"
)

include_directories(
  "${PROJECT_BINARY_DIR}/include"
  "."
)

if(BUILD_SHARED_LIBS)
  # Only export LEVELDB_EXPORT symbols from the shared library.
  add_compile_options(-fvisibility=hidden)
endif(BUILD_SHARED_LIBS)

# Must be included before CMAKE_INSTALL_INCLUDEDIR is used.
include(GNUInstallDirs)

add_library(leveldb "")
target_sources(leveldb
  PRIVATE
    "${PROJECT_BINARY_DIR}/${LEVELDB_PORT_CONFIG_DIR}/port_config.h"
    "db/builder.cc"
    "db/builder.h"
    "db/c.cc"
    "db/db_impl.cc"
    "db/db_impl.h"
    "db/db_iter.cc"
    "db/db_iter.h"
    "db/dbformat.cc"
    "db/dbformat.h"
    "db/dumpfile.cc"
    "db/filename.cc"
    "db/filename.h"
    "db/log_format.h"
    "db/log_reader.cc"
    "db/log_reader.h"
    "db/log_writer.cc"
    "db/log_writer.h"
    "db/memtable.cc"
    "db/memtable.h"
    "db/repair.cc"
    "db/skiplist.h"
    "db/snapshot.h"
    "db/table_cache.cc"
    "db/table_cache.h"
    "db/version_edit.cc"
    "db/version_edit.h"
    "db/version_set.cc"
    "db/version_set.h"
    "db/write_batch_internal.h"
    "db/write_batch.cc"
    "port/port_stdcxx.h"
    "port/port.h"
    "port/thread_annotations.h"
    "table/block_builder.cc"
    "table/block_builder.h"
    "table/block.cc"
    "table/block.h"
    "table/filter_block.cc"
    "table/filter_block.h"
    "table/format.cc"
    "table/format.h"
    "table/iterator_wrapper.h"
    "table/iterator.cc"
    "table/merger.cc"
    "table/merger.h"
    "table/table_builder.cc"
    "table/table.cc"
    "table/two_level_iterator.cc"
    "table/two_level_iterator.h"
    "util/arena.cc"
    "util/arena.h"
    "util/bloom.cc"
    "util/cache.cc"
    "util/coding.cc"
    "util/coding.h"
    "util/comparator.cc"
    "util/crc32c.cc"
    "util/crc32c.h"
    "util/env.cc"
    "util/filter_policy.cc"
    "util/hash.cc"
    "util/hash.h"
    "util/logging.cc"
    "util/logging.h"
    "util/mutexlock.h"
    "util/no_destructor.h"
    "util/options.cc"
    "util/random.h"
    "util/status.cc"

  # Only CMake 3.3+ supports PUBLIC sources in targets exported by "install".
  $<$<VERSION_GREATER:CMAKE_VERSION,3.2>:PUBLIC>
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/c.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/cache.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/comparator.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/db.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/dumpfile.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/env.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/export.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/filter_policy.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/iterator.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/options.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/slice.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/status.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/table_builder.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/table.h"
    "${LEVELDB_PUBLIC_INCLUDE_DIR}/write_batch.h"
)

if (WIN32)
  target_sources(leveldb
    PRIVATE
      "util/env_windows.cc"
      "util/windows_logger.h"
  )
else (WIN32)
  target_sources(leveldb
    PRIVATE
      "util/env_posix.cc"
      "util/posix_logger.h"
  )
endif (WIN32)

# MemEnv is not part of the interface and could be pulled to a separate library.
target_sources(leveldb
  PRIVATE
    "helpers/memenv/memenv.cc"
    "helpers/memenv/memenv.h"
)

target_include_directories(leveldb
  PUBLIC
    $<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)

set_target_properties(leveldb
  PROPERTIES VERSION ${PROJECT_VERSION} SOVERSION ${PROJECT_VERSION_MAJOR})

target_compile_definitions(leveldb
  PRIVATE
    # Used by include/export.h when building shared libraries.
    LEVELDB_COMPILE_LIBRARY
    # Used by port/port.h.
    ${LEVELDB_PLATFORM_NAME}=1
)
if (NOT HAVE_CXX17_HAS_INCLUDE)
  target_compile_definitions(leveldb
    PRIVATE
      LEVELDB_HAS_PORT_CONFIG_H=1
  )
endif(NOT HAVE_CXX17_HAS_INCLUDE)

if(BUILD_SHARED_LIBS)
  target_compile_definitions(leveldb
    PUBLIC
      # Used by include/export.h.
      LEVELDB_SHARED_LIBRARY
  )
endif(BUILD_SHARED_LIBS)

if(HAVE_CLANG_THREAD_SAFETY)
  target_compile_options(leveldb
    PUBLIC
      -Werror -Wthread-safety)
endif(HAVE_CLANG_THREAD_SAFETY)

if(HAVE_CRC32C)
  target_link_libraries(leveldb crc32c)
endif(HAVE_CRC32C)
if(HAVE_SNAPPY)
  target_link_libraries(leveldb snappy)
endif(HAVE_SNAPPY)
if(HAVE_ZSTD)
  target_link_libraries(leveldb zstd)
endif(HAVE_ZSTD)
if(HAVE_TCMALLOC)
  target_link_libraries(leveldb tcmalloc)
endif(HAVE_TCMALLOC)

# Needed by port_stdcxx.h
find_package(Threads REQUIRED)
target_link_libraries(leveldb Threads::Threads)

add_executable(leveldbutil
  "db/leveldbutil.cc"
)
target_link_libraries(leveldbutil leveldb)
target_link_options(leveldbutil PRIVATE ${PRIVATE_TARGET_LINK_OPTIONS})

###### START Wasm modifications ######
if (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
# Generate glue js and cpp via webidl_binder.
set(WEBIDL_TS_DEFINITIONS
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/idl/leveldbwasm.d.ts"
)
set(WEBIDL_BINDER_INPUT
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/idl/interface.idl"
)
set(WEBIDL_BINDER_OUTPUT
  "glue.cpp"
  "glue.js"
  "leveldbwasm.d.ts"
)
add_custom_command(
  OUTPUT ${WEBIDL_BINDER_OUTPUT}
  COMMAND ${CMAKE_SOURCE_DIR}/third_party/emsdk/upstream/emscripten/tools/webidl_binder ${WEBIDL_BINDER_INPUT} glue
  COMMAND cp ${WEBIDL_TS_DEFINITIONS} ./
  DEPENDS ${WEBIDL_BINDER_INPUT} ${WEBIDL_TS_DEFINITIONS}
)
add_custom_target(generate_webidl_glue DEPENDS ${WEBIDL_BINDER_OUTPUT})

# Generate the leveldb wasm including glue.
add_executable(leveldbwasm)
add_dependencies(leveldbwasm generate_webidl_glue)
target_sources(leveldbwasm
  PRIVATE
    "wasm/idl/glue_wrapper.cc"
    "wasm/idl/db.cc"
    "wasm/idl/db.h"
    "wasm/idl/dbwrapper.cc"
    "wasm/idl/dbwrapper.h"
    "wasm/idl/status.cc"
    "wasm/idl/status.h"
    "wasm/idl/iterator.cc"
    "wasm/idl/iterator.h"
)
target_include_directories(leveldbwasm PRIVATE ${PROJECT_BINARY_DIR})
target_link_options(leveldbwasm
  PUBLIC --post-js glue.js -sMODULARIZE -sEXPORT_ES6 -sEXPORTED_FUNCTIONS=_malloc,_free -sALLOW_MEMORY_GROWTH -sPTHREAD_POOL_SIZE=8 -sWASMFS
)
if (CMAKE_SYSTEM_NAME STREQUAL "Debug")
  target_link_options(leveldbwasm
    PUBLIC -sASSERTIONS -g -gsource-map
  )
else (CMAKE_SYSTEM_NAME STREQUAL "Debug")
  target_link_options(leveldbwasm
    PUBLIC -O3
  )
endif (CMAKE_SYSTEM_NAME STREQUAL "Debug")
target_link_libraries(leveldbwasm leveldb)

set(NODE_PACKAGE_INPUT
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/package.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/package-lock.json"
)
add_custom_command(
  OUTPUT node_modules
  DEPENDS ${NODE_PACKAGE_INPUT}
  COMMAND cp ${NODE_PACKAGE_INPUT} ./
  COMMAND npm install
)

# Copy typescript files into build directory (where glue.js also lives), then generate .js.
set(JS_API_INPUT
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/js-api/leveldb_connection.ts"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/js-api/leveldb_iterator.ts"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/js-api/leveldb_db.ts"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/js-api/leveldb_worker.ts"
)
set(JS_API_OUTPUT
  "leveldb_connection.js"
  "leveldb_iterator.js"
  "leveldb_db.js"
  "leveldb_worker.js"
)
# Strip paths from filenames.
set(JS_API_INPUT_STRIPPED ${JS_API_INPUT})
list(TRANSFORM JS_API_INPUT_STRIPPED REPLACE ".*/" "")
add_custom_command(
  OUTPUT ${JS_API_OUTPUT}
  DEPENDS node_modules
  DEPENDS ${WEBIDL_BINDER_OUTPUT}
  DEPENDS ${JS_API_INPUT}
  COMMAND cp ${JS_API_INPUT} ./
  COMMAND npx tsc --module es2022 --target es2022 --noImplicitAny ${JS_API_INPUT_STRIPPED} --experimentalDecorators
)
add_custom_target(jsapi DEPENDS ${JS_API_OUTPUT})
add_dependencies(jsapi leveldbwasm)

set(DEMO_JS_INPUT
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/demo/main.ts"
)
set(DEMO_JS_OUTPUT
  "main.js"
)
# Strip paths from filenames.
set(DEMO_JS_INPUT_STRIPPED ${DEMO_JS_INPUT})
list(TRANSFORM DEMO_JS_INPUT_STRIPPED REPLACE ".*/" "")
add_custom_command(
  OUTPUT ${DEMO_JS_OUTPUT}
  DEPENDS node_modules
  DEPENDS ${DEMO_JS_INPUT}
  DEPENDS ${JS_API_OUTPUT}
  COMMAND cp ${DEMO_JS_INPUT} ./
  COMMAND npx tsc --module es2022 --target es2022 --noImplicitAny ${DEMO_JS_INPUT_STRIPPED} --experimentalDecorators
)
add_custom_target(leveldbwasmdemo_js DEPENDS ${DEMO_JS_OUTPUT})
add_dependencies(leveldbwasmdemo_js jsapi)

set(DEMO_INPUT
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/demo/demo.html"
)
set(DEMO_OUTPUT ${DEMO_INPUT})
list(TRANSFORM DEMO_OUTPUT REPLACE ".*/" "")

add_custom_command(
  OUTPUT ${DEMO_OUTPUT}
  DEPENDS ${DEMO_INPUT}
  COMMAND cp ${DEMO_INPUT} ./
)
add_custom_target(leveldbwasmdemo DEPENDS ${DEMO_OUTPUT})
add_dependencies(leveldbwasmdemo leveldbwasmdemo_js)

### Benchmark ###
set(IDBKV
  "${CMAKE_CURRENT_SOURCE_DIR}/third_party/idb-keyval/src/index.ts"
)
set(IDBKV_OUTPUT
  "idbkv.js"
)
add_custom_command(
  OUTPUT ${IDBKV_OUTPUT}
  DEPENDS node_modules
  DEPENDS ${IDBKV}
  COMMAND npx tsc ${IDBKV} --outDir idbkv --module es2022 --target es2022
)

set(BENCHMARK_INPUT
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/benchmark.html"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/benchmark.js"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/benchmark.css"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/jswasm/sqlite3.js"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/jswasm/sqlite3.wasm"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/jswasm/sqlite3-opfs-async-proxy.js"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/jswasm/sqlite3-worker1.js"
  "${CMAKE_CURRENT_SOURCE_DIR}/wasm/benchmark/jswasm/sqlite3-worker1-promiser.js"
)
set(BENCHMARK_OUTPUT ${BENCHMARK_INPUT})
list(TRANSFORM BENCHMARK_OUTPUT REPLACE ".*/" "")
add_custom_command(
  OUTPUT ${BENCHMARK_OUTPUT}
  DEPENDS ${BENCHMARK_INPUT}
  COMMAND cp ${BENCHMARK_INPUT} ./
)

add_custom_target(leveldbwasmbench
  DEPENDS ${IDBKV_OUTPUT}
  DEPENDS ${BENCHMARK_OUTPUT})
add_dependencies(leveldbwasmbench leveldbwasm jsapi)
endif (CMAKE_SYSTEM_NAME STREQUAL Emscripten)
###### END Wasm modifications ######

if(LEVELDB_BUILD_TESTS)
  enable_testing()

  # Prevent overriding the parent project's compiler/linker settings on Windows.
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  set(install_gtest OFF)
  set(install_gmock OFF)
  set(build_gmock ON)

  # This project is tested using GoogleTest.
  add_subdirectory("third_party/googletest")

  # GoogleTest triggers a missing field initializers warning.
  if(LEVELDB_HAVE_NO_MISSING_FIELD_INITIALIZERS)
    set_property(TARGET gtest
        APPEND PROPERTY COMPILE_OPTIONS -Wno-missing-field-initializers)
    set_property(TARGET gmock
        APPEND PROPERTY COMPILE_OPTIONS -Wno-missing-field-initializers)
  endif(LEVELDB_HAVE_NO_MISSING_FIELD_INITIALIZERS)

  add_executable(leveldb_tests "")
  target_sources(leveldb_tests
    PRIVATE
      # "db/fault_injection_test.cc"
      # "issues/issue178_test.cc"
      # "issues/issue200_test.cc"
      # "issues/issue320_test.cc"
      "${PROJECT_BINARY_DIR}/${LEVELDB_PORT_CONFIG_DIR}/port_config.h"
      # "util/env_test.cc"
      "util/status_test.cc"
      "util/no_destructor_test.cc"
      "util/testutil.cc"
      "util/testutil.h"
  )
  if(NOT BUILD_SHARED_LIBS)
    target_sources(leveldb_tests
      PRIVATE
        "db/autocompact_test.cc"
        "db/corruption_test.cc"
        "db/db_test.cc"
        "db/dbformat_test.cc"
        "db/filename_test.cc"
        "db/log_test.cc"
        "db/recovery_test.cc"
        "db/skiplist_test.cc"
        "db/version_edit_test.cc"
        "db/version_set_test.cc"
        "db/write_batch_test.cc"
        "helpers/memenv/memenv_test.cc"
        "table/filter_block_test.cc"
        "table/table_test.cc"
        "util/arena_test.cc"
        "util/bloom_test.cc"
        "util/cache_test.cc"
        "util/coding_test.cc"
        "util/crc32c_test.cc"
        "util/hash_test.cc"
        "util/logging_test.cc"
    )
  endif(NOT BUILD_SHARED_LIBS)
  target_link_libraries(leveldb_tests leveldb gmock gtest gtest_main)
  target_link_options(leveldb_tests PRIVATE ${PRIVATE_TARGET_LINK_OPTIONS})
  target_compile_definitions(leveldb_tests
    PRIVATE
      ${LEVELDB_PLATFORM_NAME}=1
  )
  if (NOT HAVE_CXX17_HAS_INCLUDE)
    target_compile_definitions(leveldb_tests
      PRIVATE
        LEVELDB_HAS_PORT_CONFIG_H=1
    )
  endif(NOT HAVE_CXX17_HAS_INCLUDE)

  add_test(NAME "leveldb_tests" COMMAND "leveldb_tests")

  function(leveldb_test test_file)
    get_filename_component(test_target_name "${test_file}" NAME_WE)

    add_executable("${test_target_name}" "")
    target_sources("${test_target_name}"
      PRIVATE
        "${PROJECT_BINARY_DIR}/${LEVELDB_PORT_CONFIG_DIR}/port_config.h"
        "util/testutil.cc"
        "util/testutil.h"

        "${test_file}"
    )
    target_link_libraries("${test_target_name}" leveldb gmock gtest)
    target_link_options("${test_target_name}" PRIVATE ${PRIVATE_TARGET_LINK_OPTIONS})
    target_compile_definitions("${test_target_name}"
      PRIVATE
        ${LEVELDB_PLATFORM_NAME}=1
    )
    if (NOT HAVE_CXX17_HAS_INCLUDE)
      target_compile_definitions("${test_target_name}"
        PRIVATE
          LEVELDB_HAS_PORT_CONFIG_H=1
      )
    endif(NOT HAVE_CXX17_HAS_INCLUDE)

    add_test(NAME "${test_target_name}" COMMAND "${test_target_name}")
  endfunction(leveldb_test)

  leveldb_test("db/c_test.c")

  if(NOT BUILD_SHARED_LIBS)
    # TODO(costan): This test also uses
    #               "util/env_{posix|windows}_test_helper.h"
    if (WIN32)
      leveldb_test("util/env_windows_test.cc")
    else (WIN32)
      leveldb_test("util/env_posix_test.cc")
    endif (WIN32)
  endif(NOT BUILD_SHARED_LIBS)
endif(LEVELDB_BUILD_TESTS)

if(LEVELDB_BUILD_BENCHMARKS)
  # This project uses Google benchmark for benchmarking.
  set(BENCHMARK_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
  set(BENCHMARK_ENABLE_EXCEPTIONS OFF CACHE BOOL "" FORCE)
  add_subdirectory("third_party/benchmark")

  function(leveldb_benchmark bench_file)
    get_filename_component(bench_target_name "${bench_file}" NAME_WE)

    add_executable("${bench_target_name}" "")
    target_sources("${bench_target_name}"
      PRIVATE
        "${PROJECT_BINARY_DIR}/${LEVELDB_PORT_CONFIG_DIR}/port_config.h"
        "util/histogram.cc"
        "util/histogram.h"
        "util/testutil.cc"
        "util/testutil.h"

        "${bench_file}"
    )
    target_link_libraries("${bench_target_name}" leveldb gmock gtest benchmark)
    target_link_options("${bench_target_name}" PRIVATE ${PRIVATE_TARGET_LINK_OPTIONS})
    target_compile_definitions("${bench_target_name}"
      PRIVATE
        ${LEVELDB_PLATFORM_NAME}=1
    )
    if (NOT HAVE_CXX17_HAS_INCLUDE)
      target_compile_definitions("${bench_target_name}"
        PRIVATE
          LEVELDB_HAS_PORT_CONFIG_H=1
      )
    endif(NOT HAVE_CXX17_HAS_INCLUDE)
  endfunction(leveldb_benchmark)

  if(NOT BUILD_SHARED_LIBS)
    leveldb_benchmark("benchmarks/db_bench.cc")
  endif(NOT BUILD_SHARED_LIBS)

  check_library_exists(sqlite3 sqlite3_open "" HAVE_SQLITE3)
  if(HAVE_SQLITE3)
    leveldb_benchmark("benchmarks/db_bench_sqlite3.cc")
    target_link_libraries(db_bench_sqlite3 sqlite3)
    target_link_options(db_bench_sqlite3 PRIVATE ${PRIVATE_TARGET_LINK_OPTIONS})
  endif(HAVE_SQLITE3)

  # check_library_exists is insufficient here because the library names have
  # different manglings when compiled with clang or gcc, at least when installed
  # with Homebrew on Mac.
  set(OLD_CMAKE_REQURED_LIBRARIES ${CMAKE_REQUIRED_LIBRARIES})
  list(APPEND CMAKE_REQUIRED_LIBRARIES kyotocabinet)
  check_cxx_source_compiles("
#include <kcpolydb.h>

int main() {
  kyotocabinet::TreeDB* db = new kyotocabinet::TreeDB();
  delete db;
  return 0;
}
  "  HAVE_KYOTOCABINET)
  set(CMAKE_REQUIRED_LIBRARIES ${OLD_CMAKE_REQURED_LIBRARIES})
  if(HAVE_KYOTOCABINET)
    leveldb_benchmark("benchmarks/db_bench_tree_db.cc")
    target_link_libraries(db_bench_tree_db kyotocabinet)
    target_link_options(db_bench_tree_db PRIVATE ${PRIVATE_TARGET_LINK_OPTIONS})
  endif(HAVE_KYOTOCABINET)
endif(LEVELDB_BUILD_BENCHMARKS)

if(LEVELDB_INSTALL)
  install(TARGETS leveldb
    EXPORT leveldbTargets
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
  )
  install(
    FILES
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/c.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/cache.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/comparator.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/db.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/dumpfile.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/env.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/export.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/filter_policy.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/iterator.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/options.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/slice.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/status.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/table_builder.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/table.h"
      "${LEVELDB_PUBLIC_INCLUDE_DIR}/write_batch.h"
    DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}/leveldb"
  )

  include(CMakePackageConfigHelpers)
  configure_package_config_file(
    "cmake/${PROJECT_NAME}Config.cmake.in"
    "${PROJECT_BINARY_DIR}/cmake/${PROJECT_NAME}Config.cmake"
    INSTALL_DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME}"
  )
  write_basic_package_version_file(
    "${PROJECT_BINARY_DIR}/cmake/${PROJECT_NAME}ConfigVersion.cmake"
    COMPATIBILITY SameMajorVersion
  )
  install(
    EXPORT leveldbTargets
    NAMESPACE leveldb::
    DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME}"
  )
  install(
    FILES
      "${PROJECT_BINARY_DIR}/cmake/${PROJECT_NAME}Config.cmake"
      "${PROJECT_BINARY_DIR}/cmake/${PROJECT_NAME}ConfigVersion.cmake"
    DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME}"
  )
endif(LEVELDB_INSTALL)
