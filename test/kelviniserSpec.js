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

var klvUtil = require('../util/klvUtil.js');
var tape = require('tape');
var uuid = require('uuid');
var H = require('highland');
var kelvinator = require('../pipelines/kelvinator.js');
var kelviniser = require('../pipelines/kelviniser.js');
var KLVPacket = require('../model/KLVPacket.js');

var testPacket = new KLVPacket(uuid.v4(), 42, Buffer.allocUnsafe(42), 4, 0);

tape('Test conversion of packet to bytes', t => {
  var b = [];
  t.ok(KLVPacket.isKLVPacket(testPacket), 'test packet shows up as a packet.');
  H([testPacket]).through(kelvinator()).errors(t.fail).each(x => { b.push(x); })
    .done(() => { t.pass(`finished pipeline.`)});
  t.ok(Array.isArray(b) && b.length === 2, 'creates an array of length 2.');
  t.ok(b.every(x => Buffer.isBuffer(x)), 'every element of the array is a buffer.');
  var c = Buffer.concat(b);
  t.equal(c.length, 16 + 4 + 42, 'buffers have expected total length.');
  t.equal(uuid.unparse(c.slice(0, 16)), testPacket.key, 'contains key bytes.');
  t.equal(c.readUInt8(16), 0x80 | (4 - 1), 'BER length header is as expected.');
  t.equal(c.readUIntBE(17, 3), 42, 'BER length value is as expected.');
  t.ok(c.slice(-42).equals(testPacket.value[0]), 'values are equal.');
  t.end();
});

tape('Test packet roundtrip with separate buffers', t => {
  var madePacket = null;
  H([testPacket])
    .through(kelvinator())
    .through(kelviniser(true))
    .errors(t.fail)
    .each(x => { madePacket = x; })
    .done(() => t.pass('pipeline finished.'));
  t.ok(KLVPacket.isKLVPacket(madePacket), 'made a new packet.');
  t.deepEqual(madePacket, testPacket, 'packets are equal.');
  t.end();
});


tape('Test packet roundtrip with collected buffers', t => {
  var madePacket = null;
  H([testPacket])
    .through(kelvinator())
    .collect()
    .map(Buffer.concat)
    .through(kelviniser(true))
    .errors(t.fail)
    .each(x => { madePacket = x; })
    .done(() => t.pass('pipeline finished.'));
  t.ok(KLVPacket.isKLVPacket(madePacket), 'made a new packet.');
  t.deepEqual(madePacket, testPacket, 'packets are equal.');
  t.end();
});

var tp1 = new KLVPacket(uuid.v4(), 42, Buffer.allocUnsafe(42), 1, 0);
var tp2 = new KLVPacket(uuid.v4(), 1000, Buffer.allocUnsafe(1000), 4, tp1.size());
var tp3 = new KLVPacket(uuid.v4(), 4200000, Buffer.allocUnsafe(4200000), 9, tp2.filePos + tp2.size());

var bigBuf = null;
H([tp1, tp2, tp3]).through(kelvinator())
  .collect().map(Buffer.concat).each(x => { bigBuf = x; });

tape('Roundtrip boundary testing - single buffer', t => {
  var result = null;
  H([bigBuf])
    .through(kelviniser())
    .errors(t.fail)
    .toArray(a => { result = a; t.pass('pipeline finished.')});
  t.ok(Array.isArray(result), 'result is an array.');
  t.equal(result.length, 3, 'array is of the expected length.');
  t.ok(result.every(x => KLVPacket.isKLVPacket(x)), 'every entry is a KLV packet.');
  result.forEach(x => x.flattenValue());
  t.deepEqual(result[0], tp1, 'first packet matches.');
  t.deepEqual(result[1], tp2, 'second packet matches.');
  t.deepEqual(result[2], tp3, 'third packet matches.');
  t.end();
});

tape('Roundtrip boundary testing - split first value', t => {
  var result = null;
  H([bigBuf.slice(0, 32), bigBuf.slice(32)])
    .through(kelviniser())
    .errors(t.fail)
    .toArray(a => { result = a; t.pass('pipeline finished.')});
  t.ok(Array.isArray(result), 'result is an array.');
  t.equal(result.length, 3, 'array is of the expected length.');
  t.ok(result.every(x => KLVPacket.isKLVPacket(x)), 'every entry is a KLV packet.');
  result.forEach(x => x.flattenValue());
  t.deepEqual(result[0], tp1, 'first packet matches.');
  t.deepEqual(result[1], tp2, 'second packet matches.');
  t.deepEqual(result[2], tp3, 'third packet matches.');
  t.end();
});

tape('Roundtrip boundary testing - split second key', t => {
  var result = null;
  H([bigBuf.slice(0, 65), bigBuf.slice(65)])
    .through(kelviniser())
    .errors(t.fail)
    .toArray(a => { result = a; t.pass('pipeline finished.')});
  t.ok(Array.isArray(result), 'result is an array.');
  t.equal(result.length, 3, 'array is of the expected length.');
  t.ok(result.every(x => KLVPacket.isKLVPacket(x)), 'every entry is a KLV packet.');
  result.forEach(x => x.flattenValue());
  t.deepEqual(result[0], tp1, 'first packet matches.');
  t.deepEqual(result[1], tp2, 'second packet matches.');
  t.deepEqual(result[2], tp3, 'third packet matches.');
  t.end();
});

tape('Roundtrip boundary testing - split third large value', t => {
  var result = null;
  H([bigBuf.slice(0, 12345), bigBuf.slice(12345)])
    .through(kelviniser())
    .errors(t.fail)
    .toArray(a => { result = a; t.pass('pipeline finished.')});
  t.ok(Array.isArray(result), 'result is an array.');
  t.equal(result.length, 3, 'array is of the expected length.');
  t.ok(result.every(x => KLVPacket.isKLVPacket(x)), 'every entry is a KLV packet.');
  result.forEach(x => x.flattenValue());
  t.deepEqual(result[0], tp1, 'first packet matches.');
  t.deepEqual(result[1], tp2, 'second packet matches.');
  t.deepEqual(result[2], tp3, 'third packet matches.');
  t.end();
});

var randomBufs = [];
var pos = 0;
while (pos < bigBuf.length) {
  var r = Math.random() * 1024 | 0;
  randomBufs.push(bigBuf.slice(pos, pos + r));
  pos += r;
}

tape('Roundtrip boundary testing - random buffers', t => {
  var result = null;
  H(randomBufs)
    .through(kelviniser())
    .errors(t.fail)
    .toArray(a => { result = a; t.pass('pipeline finished.')});
  t.ok(Array.isArray(result), 'result is an array.');
  t.equal(result.length, 3, 'array is of the expected length.');
  t.ok(result.every(x => KLVPacket.isKLVPacket(x)), 'every entry is a KLV packet.');
  result.forEach(x => x.flattenValue());
  t.deepEqual(result[0], tp1, 'first packet matches.');
  t.deepEqual(result[1], tp2, 'second packet matches.');
  t.deepEqual(result[2], tp3, 'third packet matches.');
  t.end();
});
