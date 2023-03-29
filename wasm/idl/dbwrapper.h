// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.
#ifndef DB_WRAPPER_H_
#define DB_WRAPPER_H_

#include <string>

#include "status.h"

namespace leveldb {
class DB;
}

class DbWrapper {
 public:
  explicit DbWrapper(std::string name);
  ~DbWrapper();

  const Status& getLastStatus();

  void put(std::string k, std::string v);
  void remove(std::string k);
  const char* get(std::string k);

 private:
  leveldb::DB* db_ = nullptr;
  std::string value_;
  Status status_;
};

#endif  // DB_WRAPPER_H_
