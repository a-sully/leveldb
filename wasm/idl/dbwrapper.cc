// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "dbwrapper.h"

#include "include/leveldb/db.h"

DbWrapper::DbWrapper(std::string name) {
  leveldb::DB::Open({}, name, &db_);
}
DbWrapper::~DbWrapper() {
  delete db_;
}

void DbWrapper::put(std::string k, std::string v) {
  status_ = db_->Put({}, k, v);
}

void DbWrapper::remove(std::string k) {
  status_ = db_->Delete({}, k);
}

const char* DbWrapper::get(std::string k) {
  status_ = db_->Get({}, k, &value_);
  return value_.c_str();
}

Status* DbWrapper::getLastStatus() {
  return &status_;
}
