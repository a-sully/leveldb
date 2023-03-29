// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "dbwrapper.h"

#include "include/leveldb/db.h"
#include "include/leveldb/status.h"
#include "iterator.h"

DbWrapper::DbWrapper(const char* name) {
  leveldb::Options options;
  options.create_if_missing = true;
  auto status = leveldb::DB::Open(options, name, &db_);
  if (!status.ok())
    printf("DB::Open not alright: %s\n", status.ToString().c_str());
  status_ = status;
}

DbWrapper::~DbWrapper() { delete db_; }

void DbWrapper::put(const char* k, const char* v) {
  status_ = db_->Put({}, k, v);
}

void DbWrapper::remove(const char* k) { status_ = db_->Delete({}, k); }

const char* DbWrapper::get(const char* k) {
  status_ = db_->Get({}, k, &value_);
  return value_.c_str();
}

Iterator* DbWrapper::newIterator() { return new Iterator(db_->NewIterator({})); }

const Status& DbWrapper::getLastStatus() { return status_; }
