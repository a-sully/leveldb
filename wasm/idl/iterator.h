// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#ifndef ITERATOR_H_
#define ITERATOR_H_

#include <string>

#include "include/leveldb/status.h"
#include "status.h"

namespace leveldb {
class Iterator;
}

class Iterator {
 public:
  Iterator(leveldb::Iterator* iterator = nullptr);
  ~Iterator();

  bool valid();

  void seekToFirst();
  void seekToLast();
  void seek(const char* target);

  const char* key();
  const char* value();

  void next();
  void prev();

  const Status& status();

  // Destroys this.
  void close();

 private:
  leveldb::Iterator* iterator_;
  std::string slice_string_;

  Status status_;
};

#endif  // ITERATOR_H_
