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

var getKeyAndLength = function (buffer, position) {
  if (buffer.length - position <= 17) return { success : false, position: position };
  var berHead = buffer.readUInt8(position + 16);
  if (berHead < 128) return {
    key : buffer.slice(position, position + 16),
    length : berHead,
    success : true,
    position : position + 17
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

module.exports = {
  getKeyAndLength: getKeyAndLength
};
