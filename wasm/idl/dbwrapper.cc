// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include <iostream>

#include "dbwrapper.h"

#include "glue.cpp"
#include "include/leveldb/db.h"

DbWrapper::DbWrapper(std::string name) {
  leveldb::DB::Open({}, name, &db_);
}
DbWrapper::~DbWrapper() {
  delete db_;
}

void DbWrapper::put(std::string k, std::string v) {
  // FIXME
  std::cout << "Key: " << k << ", value: " << v;
}
