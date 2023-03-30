// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "dbwrapper.h"

#include <memory>

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

Iterator* DbWrapper::newIterator() {
  return new Iterator(db_->NewIterator({}));
}

const Status& DbWrapper::getLastStatus() { return status_; }

void DbWrapper::batchStart() {
  if (write_batch_) {
    status_ = leveldb::Status::NotSupported(
        "Called batchStart while in batch write.");
    return;
  }
  write_batch_ =
      std::unique_ptr<leveldb::WriteBatch>(new leveldb::WriteBatch());
}
void DbWrapper::batchEnd() {
  if (!write_batch_) {
    status_ = leveldb::Status::NotSupported(
        "Called batchEnd while not in batch write.");
    return;
  }
  db_->Write({}, write_batch_.get());
  write_batch_.reset();
}

void DbWrapper::batchPut(const char* k, const char* v) {
  if (!write_batch_) {
    status_ = leveldb::Status::NotSupported(
        "Called batchPut while not in batch write.");
    return;
  }
  write_batch_->Put(k, v);
}