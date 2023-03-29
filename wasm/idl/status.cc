// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "status.h"

void Status::operator=(const leveldb::Status& status) {
  status_ = status;
}

bool Status::ok() {
  return status_.ok();
}
