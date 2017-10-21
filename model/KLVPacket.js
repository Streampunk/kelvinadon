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

var uuid = require('uuid');

function KLVPacket(key, length, value, lengthLength, filePos) {
  this.key = (Buffer.isBuffer(key)) ? uuid.unparse(key) : key;
  this.length = length;
  this.value = (Buffer.isBuffer(value)) ? [ value ] : value;
  this.lengthLength = lengthLength;
  this.filePos = filePos;
}

KLVPacket.prototype.size = function () {
  return 16 + this.lengthLength + this.length;
}

KLVPacket.prototype.lengthFromValue = function () {
  this.length = this.value.reduce((x, y) => x + y.length, 0);
  return this.length;
}

KLVPacket.prototype.flattenValue = function () {
  this.value = [ Buffer.concat(this.value, this.length) ];
}

KLVPacket.isKLVPacket = function (x) {
  return x !== null &&
    typeof x === 'object' &&
    x.constructor === KLVPacket.prototype.constructor;
}

module.exports = KLVPacket;
