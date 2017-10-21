/* Copyright 2016 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var H = require('highland');
var KLVPacket = require('../model/KLVPacket.js');
var writeKeyAndLength = require('../util/klvUtil.js').writeKeyAndLength;
var uuid = require('uuid');

function kelvinwriter () {
  function mapper(x) {
    if (!KLVPacket.isKLVPacket(x))
      throw new Error('Received an object that is not a KLV packet.');
    x.lengthFromValue();
    return H([ writeKeyAndLength(x) ].concat(x.value));
  }
  return H.pipeline(H.flatMap(mapper));
}

module.exports = kelvinwriter;
