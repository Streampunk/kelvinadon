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

var klvUtil = require('../util/klvUtil.js');
var tape = require('tape');
var uuid = require('uuid');

tape('Reading and writing a 1 byte value length', t => {
  var id = uuid.v4();
  var b = klvUtil.writeKeyAndLength({ key : id, lengthLength: 1, length: 123 });
  t.ok(b, 'buffer is created.');
  t.equal(b.length, 17, 'buffer length is 17.');
  t.equal(uuid.unparse(b.slice(0, 16)), id, 'raw identifiers match.');
  t.ok((0x80 & b.readUInt8(16)) === 0, 'top bit is not set on length.');
  t.equal(b.readUInt8(16), 123, 'raw has the correct length.');

  var kl = klvUtil.getKeyAndLength(b, 0);
  t.equal(typeof kl, 'object', 'roundtrip value is an object.');
  t.equal(uuid.unparse(kl.key), id, 'roundtrip idenifiers match.');
  t.equal(kl.length, 123, 'roundtrip lengths match.');
  t.equal(kl.lengthLength, 1, 'roundtrip length length is 1.');
  t.end();
});

const sizes = [0, 0, 256, 65536, 16777216, 4294967296, 1099511627776,
  281474976710656, 72057594037927940, 18446744073709552000];

function testXBytes (s) {
  var l = Math.random() * sizes[s];
  l = l - l % 1;
  tape(`Reading and writing ${s} byte value with length ${l}`, t => {
    var id = uuid.v4();
    var b = klvUtil.writeKeyAndLength({ key : id, lengthLength: s, length: l });
    t.ok(b, 'buffer is created.');
    t.equal(b.length, 16 + s, `buffer length is ${16 + s}.`);
    t.equal(uuid.unparse(b.slice(0, 16)), id, 'raw identifiers match.');
    t.ok((0x80 & b.readUInt8(16)) > 0, 'top bit is set on length.');
    t.equal(b.readUInt8(16) & 0x7f, (s - 1), 'raw has the correct length length.');
    t.equal(b.readUIntBE(17, (s - 1)), l, 'raw has the correct length.');

    var kl = klvUtil.getKeyAndLength(b, 0);
    t.equal(typeof kl, 'object', 'roundtrip value is an object.');
    t.equal(uuid.unparse(kl.key), id, 'roundtrip idenifiers match.');
    t.equal(kl.length, l, 'roundtrip lengths match.');
    t.equal(kl.lengthLength, s, `roundtrip length length is ${s}.`);
    t.end();
  });
}

for ( var s = 2 ; s <= 7; s++ )
  testXBytes(s);

tape('Testing write length error conditions', t => {
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(3), 4, 12, 1); }, /Insufficient/,
    'detects not enough bytes available in the buffer.');
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(3), 0, 128, 1); }, /1 byte length/,
    'detects 1 byte length that is too long.');
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(3), 0, -1, 2); }, /negative/,
    'detects negative length.');
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(3), 0, 256, 2); }, /exceeds/,
    'detects length that is just too large.');
  t.doesNotThrow(() => { klvUtil.writeLength(Buffer.alloc(3), 0, 255, 2); },
    'accepts value just inside range.');
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(10), 0, 1, 0); }, /MXF defines/,
    'detects length length too small.');
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(10), 0, 1, 10); }, /MXF defines/,
    'detects leggth length too large.');
  t.throws(() => { klvUtil.writeLength(Buffer.alloc(4), 0, 1, 5); }, /Insufficient/,
    'detects not enough space in buffer for length.');
  t.end();
});
