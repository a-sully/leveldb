// Copyright 2023 The LevelDBWasm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "write_options.h"

// WriteOptions::WriteOptions(bool sync) {
//   options_ = { .sync = sync };
// }


WriteOptions::WriteOptions(bool sync): sync_(sync) {}
