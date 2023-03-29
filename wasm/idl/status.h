// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#ifndef STATUS_H_
#define STATUS_H_

#include "include/leveldb/status.h"

class Status {
 public:
  Status() = default;
  ~Status() = default;

  void operator=(const leveldb::Status& status);

  bool ok();

 private:
  leveldb::Status status_;
};

#endif  // STATUS_H_
