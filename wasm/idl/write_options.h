// Copyright 2023 The LevelDBWasm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#ifndef WRITE_OPTIONS_H_
#define WRITE_OPTIONS_H_

#include "include/leveldb/db.h"

struct WriteOptions {
 public:
  WriteOptions(bool sync = false);
  ~WriteOptions() = default;

  // const leveldb::WriteOptions& options() { return leveldb::WriteOptions{ .sync = sync }; }

  bool sync() const { return sync_ ; }

 private:
  bool sync_;
  // leveldb::WriteOptions options_;
};

#endif  // STATUS_H_
