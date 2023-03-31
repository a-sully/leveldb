// Copyright 2023 The LevelDBWasm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "db.h"

#include <memory>

#include "include/leveldb/db.h"
#include "include/leveldb/status.h"
#include "iterator.h"

Db::Db(leveldb::DB* db) : db_(db) {}

Db::~Db() = default;

void Db::put(const char* k, const char* v) { status_ = db_->Put({}, k, v); }

void Db::remove(const char* k) { status_ = db_->Delete({}, k); }

const char* Db::get(const char* k) {
  status_ = db_->Get({}, k, &value_);
  return value_.c_str();
}

Iterator* Db::newIterator() {
  status_ = leveldb::Status::OK();
  return new Iterator(db_->NewIterator({}));
}

const Status& Db::getLastStatus() { return status_; }

void Db::batchStart() {
  if (write_batch_) {
    status_ = leveldb::Status::NotSupported(
        "Called batchStart while in batch write.");
    return;
  }
  write_batch_ =
      std::unique_ptr<leveldb::WriteBatch>(new leveldb::WriteBatch());
}
void Db::batchEnd() {
  if (!write_batch_) {
    status_ = leveldb::Status::NotSupported(
        "Called batchEnd while not in batch write.");
    return;
  }
  db_->Write({}, write_batch_.get());
  write_batch_.reset();
}

void Db::batchPut(const char* k, const char* v) {
  if (!write_batch_) {
    status_ = leveldb::Status::NotSupported(
        "Called batchPut while not in batch write.");
    return;
  }
  write_batch_->Put(k, v);
}
