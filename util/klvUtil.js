/* Copyright 2017 Streampunk Media Ltd.

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

const sizes = [128, 256, 65536, 16777216, 4294967296, 1099511627776,
  281474976710656, 72057594037927940, 18446744073709552000];

var getKeyAndLength = function (buffer, position) {
  if (buffer.length - position < 17) return { success : false, position: position };
  var berHead = buffer.readUInt8(position + 16);
  if (berHead < 128) return {
    key : buffer.slice(position, position + 16),
    length : berHead,
    success : true,
    position : position + 17,
    lengthLength : 1
  };
  var tailLength = berHead & 0x7f;
  if (buffer.length - position < 17 + tailLength)
    return { success : false, position : position };
  return {
    key : buffer.slice(position, position + 16),
    length : buffer.readUIntBE(position + 17, tailLength),
    lengthLength : tailLength + 1,
    success : true,
    position : position + 17 + tailLength
  };
};

var writeLength = function (buffer, position, length, lengthLength) {
  if (buffer.length < position + lengthLength)
    throw new Error(`Insufficient space to write length into given buffer. Required ${lengthLength} of ${buffer.length-position} available.`);
  if (length < 0)
    throw new Error(`Length cannot be negative. Given ${length}.`);
  if (lengthLength < 1 || lengthLength > 9)
    throw new Error(`MXF defines that the number of bytes used for a length must be between 1 and 9. Given ${lengthLength}.`);
  if (lengthLength === 1) {
    if (length >= 128)
      throw new Error(`Attempt to write a 1 byte length with a value out of range 0 to 127. Given ${length}`);
    buffer.writeUInt8(length, position);
    return position + 1;
  }
  var tailLength = lengthLength - 1;
  if (length >= sizes[tailLength])
    throw new Error(`Length exceeds maximum value for given amount of space for ${lengthLength} bytes. Given ${length}. Maximum ${sizes[tailLength]}.`);
  buffer.writeUInt8(0x80 | tailLength, position);
  buffer.writeUIntBE(length, position + 1, tailLength);
  return position + lengthLength;
};

var writeKeyAndLength = function (klv, buffer) {
  if (!buffer)
    buffer = Buffer.allocUnsafe(16 + klv.lengthLength);
  if (klv.key.length < 36)
    throw new Error(`Key does not have enough characters to be a universal label. Key is ${klv.key}.`);
  buffer.hexWrite(klv.key.slice(0, 8), 0);
  buffer.hexWrite(klv.key.slice(9, 13), 4);
  buffer.hexWrite(klv.key.slice(14, 18), 6);
  buffer.hexWrite(klv.key.slice(19, 23), 8);
  buffer.hexWrite(klv.key.slice(24, 36), 10);
  writeLength(buffer, 16, klv.length, klv.lengthLength);
  return buffer;
};

module.exports = {
  getKeyAndLength: getKeyAndLength,
  writeLength: writeLength,
  writeKeyAndLength: writeKeyAndLength
};
