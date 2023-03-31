// Copyright 2023 The LevelDBWasm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.
#ifndef DB_H_
#define DB_H_

#include <memory>
#include <string>

#include "include/leveldb/write_batch.h"
#include "iterator.h"
#include "status.h"

namespace leveldb {
class DB;
}

class Db {
 public:
  explicit Db(leveldb::DB* db);
  ~Db();

  const Status& getLastStatus();

  void put(const char* k, const char* v);
  void remove(const char* k);
  const char* get(const char* k);
  Iterator* newIterator();

  void batchStart();
  void batchEnd();
  void batchPut(const char* k, const char* v);

 private:
  std::unique_ptr<leveldb::DB> db_;
  std::string value_;
  Status status_;
  std::unique_ptr<leveldb::WriteBatch> write_batch_;
};

#endif  // DB_WRAPPER_H_
