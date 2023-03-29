// Copyright 2023 The LevelDBWasb Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file. See the AUTHORS file for names of contributors.

#include "iterator.h"

#include "include/leveldb/iterator.h"
#include "include/leveldb/slice.h"

Iterator::Iterator(leveldb::Iterator* iterator) : iterator_(iterator){};
Iterator::~Iterator() {
  if (iterator_) {
    delete iterator_;
  }
};

bool Iterator::valid() { return iterator_->Valid(); }

void Iterator::seekToFirst() { iterator_->SeekToFirst(); }

// TODO: Return a Slice
const char* Iterator::key() {
  leveldb::Slice slice = iterator_->key();
  slice_string_ = slice.ToString();

  return slice_string_.c_str();
}
const char* Iterator::value() {
  leveldb::Slice slice = iterator_->value();
  slice_string_ = slice.ToString();

  return slice_string_.c_str();
}

void Iterator::next() { iterator_->Next(); }

void Iterator::prev() { iterator_->Prev(); }

const Status& Iterator::status() {
  status_ = iterator_->status();
  return status_;
}