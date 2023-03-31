// Copyright 2023 The LevelDBWasm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.
#ifndef DB_WRAPPER_H_
#define DB_WRAPPER_H_

#include <string>

#include "status.h"

class Db;

class DbWrapper {
 public:
  DbWrapper();
  ~DbWrapper();

  Db* open(const char* name);
  void destroy(const char* name);
  const Status& getLastStatus();

 private:
  Status status_;
};

#endif  // DB_WRAPPER_H_
