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

var H = require('highland');
var tape = require('tape');
var detailing = require('../pipelines/detailing.js');
var packetator = require('../pipelines/packetator.js');
var KLVPacket = require('../model/KLVPacket.js');
var meta = require('../util/meta.js');
var uuid = require('uuid');

const footer = {
  ObjectClass: 'FooterClosedCompletePartitionPack',
  MajorVersion: 1,
  MinorVersion: 2,
  KAGSize: 512,
  ThisPartition: 80970752,
  PreviousPartition: 77423616,
  FooterPartition: 80970752,
  HeaderByteCount: 0,
  IndexByteCount: 512,
  IndexSID: 1,
  BodyOffset: 0,
  BodySID: 0,
  OperationalPattern: '060e2b34-0401-0101-0d01-020101010900',
  EssenceContainers: [
    '060e2b34-0401-0102-0d01-030102046001',
    '060e2b34-0401-0109-0d01-0301020e0000',
    '060e2b34-0401-0101-0d01-030102060300' ] };

tape('Convert JSON object to KLV for fixed length pack', t => {
  H([footer])
    .through(packetator())
    .errors(t.fail)
    .each(klv => {
      t.ok(KLVPacket.isKLVPacket(klv), 'creates a KLV packet.');
      t.deepEqual(klv.detail, footer, 'embeds the original object as detail.');
      t.ok(klv.meta && klv.meta.Symbol === footer.ObjectClass,
        'embeds the meta definition of the object class.');
      t.equal(klv.key, meta.ulToUUID(klv.meta.Identification), 'class key and KLV key match.');
      t.ok(Buffer.isBuffer(klv.value[0]) && klv.value[0].length === klv.length,
        'value is a buffer of the correct length.');
      t.equal(klv.lengthLength, 4, 'header metadata sets have BER length of 4 bytes.');
      t.end();
    }).done(() => { t.pass('pipeline ended.'); });
});

tape('Convert detail inside JSON object to KLV for fixed length pack', t => {
  H([{ detail: footer }])
    .through(packetator())
    .errors(t.fail)
    .each(klv => {
      t.ok(KLVPacket.isKLVPacket(klv), 'creates a KLV packet.');
      t.deepEqual(klv.detail, footer, 'embeds the original object as detail.');
      t.ok(klv.meta && klv.meta.Symbol === footer.ObjectClass,
        'embeds the meta definition of the object class.');
      t.equal(klv.key, meta.ulToUUID(klv.meta.Identification), 'class key and KLV key match.');
      t.ok(Buffer.isBuffer(klv.value[0]) && klv.value[0].length === klv.length,
        'value is a buffer of the correct length.');
      t.equal(klv.lengthLength, 4, 'header metadata sets have BER length of 4 bytes.');
      t.end();
    }).done(() => { t.pass('pipeline ended.'); });
});

tape('Roundtrip detail to and from bytes for fixed length pack', t => {
  H([footer])
    .through(packetator())
    .map(x => { delete x.detail; return x; })
    .through(detailing())
    .each(klv => {
      t.ok(KLVPacket.isKLVPacket(klv), 'creates a KLV packet.');
      t.deepEqual(klv.detail, footer, 'embeds the original object as detail.');
      t.end();
    }).done(() => { t.pass('pipeline ended.'); });
});

var timecode = {
  ObjectClass: 'Timecode',
  InstanceID: '2eef6a04-5614-141e-4daa-00b00901b339',
  ComponentDataDefinition: '060e2b34-0401-0101-0103-020101000000',
  ComponentLength: 250,
  FramesPerSecond: 25,
  StartTimecode: 0,
  DropFrame: false };

tape('Convert JSON object to KLV for local set', t => {
  H([timecode])
    .through(packetator())
    .errors(t.fail)
    .each(klv => {
      t.deepEqual(klv.detail, timecode, 'sets detail as expected.');
      t.ok(klv.meta && klv.meta.Symbol === 'Timecode', 'has metadata of expected object class.');
      var baseKey = meta.ulToUUID(klv.meta.Identification);
      t.equal(klv.key, baseKey.slice(0, 11) + '53' + baseKey.slice(13), 'key represents meta.');
      t.equal(klv.lengthLength, 4, 'length length has been set to 4.');
      t.ok(typeof klv.length === 'number' && !isNaN(klv.length), 'length is a number.');
    }).done(() => { t.pass('pipeline ended.'); t.end(); });
});

tape('Roundtrip JSON object to and from local set', t => {
  H([timecode])
    .through(packetator())
    .map(x => {
      delete x.detail;
      delete x.props;
      return x;
    })
    .through(detailing())
    .errors(t.fail)
    .each(klv => {
      t.deepEqual(klv.detail, timecode, 'timecode value roundtrips OK.');
      t.ok(klv.props && klv.props.length === 6, 'recreates a props array.');
    })
    .done(() => { t.pass('pipeline ended'); t.end(); });
});

var essence = {
  ObjectClass: 'EssenceElement',
  InstanceID: uuid.v4(),
  ItemType: 'GC Picture',
  ElementType: 0x42,
  ElementCount: 0x04,
  ElementNumber: 0x02,
  Data: Buffer.allocUnsafe(2042)
};

var essenceWithTrack = JSON.parse(JSON.stringify(essence));
essenceWithTrack.Track = '15044202';
essenceWithTrack.Data = essence.Data;

tape('Convert JSON object to KLV for essence element', t => {
  H([essence])
    .through(packetator())
    .errors(t.fail)
    .each(klv => {
      t.deepEqual(klv.detail, essenceWithTrack, 'sets detail as expected with track.');
      t.ok(klv.meta && klv.meta.Symbol === 'EssenceElement', 'has metadata of expected class.');
      t.equal(klv.key.slice(0, -8), meta.ulToUUID(klv.meta.Identification).slice(0, -8),
        'key starts with base essence element key.');
      t.equal(klv.key.slice(-8), klv.detail.Track, 'key ends with track number.');
      t.equal(klv.lengthLength, 4, 'length length has been set to 4.');
      t.ok(typeof klv.length === 'number' && !isNaN(klv.length), 'length is a number.');
    }).done(() => { t.pass('pipeline ended.'); t.end(); });
});
