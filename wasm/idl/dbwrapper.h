// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#ifndef DB_WRAPPER_H_
#define DB_WRAPPER_H_

namespace leveldb {
class DB;
}

class DbWrapper {
 public:
  DbWrapper(std::string name);
  ~DbWrapper();

  void put(std::string k, std::string v);

 private:
  leveldb::DB* db_;
};

#endif  // DB_WRAPPER_H_
