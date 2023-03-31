// Copyright 2023 The LevelDBWasm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "dbwrapper.h"

#include "include/leveldb/db.h"
#include "include/leveldb/status.h"

#include "db.h"

DbWrapper::DbWrapper() = default;

DbWrapper::~DbWrapper() = default;

Db* DbWrapper::open(const char* name) {
  leveldb::Options options;
  options.create_if_missing = true;

  leveldb::DB* leveldb = nullptr;
  Db* db = nullptr;
  leveldb::Status status = leveldb::DB::Open(options, name, &leveldb);
  if (status.ok()) {
    db = new Db(leveldb);
  } else {
    printf("DB::Open not alright: %s\n", status.ToString().c_str());
  }
  status_ = status;
  return db;
}

void DbWrapper::destroy(const char* name) {
  leveldb::Options options;
  status_ = leveldb::DestroyDB(name, options);
}

const Status& DbWrapper::getLastStatus() { return status_; }
