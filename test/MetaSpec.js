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

var meta = require('../util/meta.js');
var tape = require('tape');
var uuid = require('uuid');

function knownMetatype (t) {
  if (typeof t !== 'string') return false;
  switch (t) {
  case 'ClassDefinition':
  case 'PropertyDefinition':
  case 'LabelDefinition':
    return true;
  default:
    return t.startsWith('TypeDefinition');
  }
}

tape('Test resolve by ID', t => {
  meta.resolveByID('060e2b34-0101-0102-0601-010401030000').then(def => {
    t.ok(def, 'baseline def retrieved.');
    t.equal(def.Name, 'Codec Definition', 'baseline def has the expected name.');
    t.equal(def.Identification, 'urn:smpte:ul:060e2b34.01010102.06010104.01030000',
      'baseline def has the expected identififation');
    t.equal(def.UUID, '060e2b34-0101-0102-0601-010401030000',
      'has expected local UUID.');
    t.equal(def.MetaType, 'PropertyDefinition',
      'baseline def has expected meta type.');
  })
    .then(meta.resolveByID.bind(meta, '060e2b34-0101-0105-0601-010715000000'))
    .then(def => {
      t.ok(def, 'mxf def retrieved.');
      t.equal(def.Name, 'Local Tag Entries', 'mxf def has the expected name.');
      t.equal(def.Identification, 'urn:smpte:ul:060e2b34.01010105.06010107.15000000',
        'mxf def has the expected identification.');
      t.equal(def.UUID, '060e2b34-0101-0105-0601-010715000000',
        'has expected local UUID.');
      t.equal(def.MetaType, 'PropertyDefinition',
        'mxf def has expected meta type.');
      t.end();
    }).catch(t.fail);
});

tape('Test resolve by name', t => {
  meta.resolveByName('TypeDefinition', 'LocalTagEntryBatch').then(def => {
    t.ok(def, 'mxf def retrieved.');
    t.equal(def.Name, 'LocalTagEntryBatch', 'mxf def has expected name.');
    t.equal(def.Identification, 'urn:smpte:ul:060e2b34.01040101.04030300.00000000',
      'mxf def has expected id.');
    t.equal(def.UUID, '060e2b34-0104-0101-0403-030000000000',
      'has expected local UUID.');
    t.equal(def.MetaType, 'TypeDefinitionSet',
      'mxf def has expected meta type.');
  })
    .then(meta.resolveByName.bind(meta, 'ClassDefinition', 'PictureDescriptor'))
    .then(def => {
      t.ok(def, 'baseline def retrieved.');
      t.equal(def.Name, 'Picture Descriptor', 'baseline def has expected name.');
      t.equal(def.Identification, 'urn:smpte:ul:060e2b34.027f0101.0d010101.01012700',
        'baseline def has expected id.');
      t.equal(def.MetaType, 'ClassDefinition',
        'baseline def has expected meta type.');
      t.end();
    }).catch(t.fail);
});

tape('Test each type', t => {
  meta.getAllIDs().then(ids => {
    t.ok(Array.isArray(ids) && ids.length > 0, 'list of IDs is an array with entries.');
    return ids;
  })
    .then(ids => {
      var tests = ids.map(id => {
        return meta.resolveByID(id).then(def => {
          t.ok(def, `definition with ${id} exists.`);
          t.equal(meta.ulToUUID(def.Identification), id, `Identification property ${def.Identification} is ${id}.`);
          t.ok(knownMetatype(def.MetaType), `definition with ${id} has a meta type.`);
          t.ok(def.Symbol && typeof def.Symbol === 'string' && def.Symbol.length > 0,
            `definition with ${id} has symbol ${def.Symbol}.`);
          t.equal(def.UUID, id, `hash key and UUID match for ${id}.`);
          if (def.MetaType === 'PropertyDefinition') {
            return (def.MemberOf ?
              meta.resolveByName('ClassDefinition', def.MemberOf[0]).then(mem => {
                t.ok(mem, `property ${def.Name} is a member of a known class.`);
              }) : Promise.resolve())
              .then(meta.resolveByName.bind(meta, 'TypeDefinition', def.Type))
              .then(ref => {
                t.ok(ref, `property ${def.Name} references a known type.`);
              });
          }
          if (def.MetaType === 'ClassDefinition' && def.Parent) {
            return meta.resolveByName('ClassDefinition', def.Parent).then(p => {
              t.ok(p, `class ${def.name} references a known parent.`);
            });
          }
        });
      });
      return Promise.all(tests);
    })
    .then(() => { t.end(); }, t.fail);
});

tape('Test matching definitions by name and by ID', t => {
  meta.getAllIDs().then(ids => {
    t.ok(Array.isArray(ids) && ids.length > 0, 'list of IDs is an array with entries.');
    return ids;
  })
    .then(ids => {
      var tests = ids.map(id => {
        return meta.resolveByID(id).then(def => {
          if (def.MetaType !== 'ExtendibleEnumerationElement') {
            return meta.resolveByName(
              (def.MetaType.startsWith('Type')) ? 'TypeDefinition' : def.MetaType,
              def.Symbol).then(res => {
              t.ok(res, `definition ${def.Identification} is in both.`);
              if (res.NamespaceName === def.NamespaceName) {
                t.deepEqual(res, def, `definitions for ${def.Identification} match.`);
              } else {
                console.error(`Found different definition of ${def.Symbol} in namespaces ${res.NamespaceName} and ${def.NamespaceName}.`);
              }
            });
          }
        });
      });
      return Promise.all(tests);
    })
    .then(() => { t.end(); }, t.fail);
});

tape('Test get integer sizes', t => {
  var toTest = [ ['UInt8', 1], ['Int8', 1], ['UInt16', 2], ['Int16', 2],
    ['UInt32', 4], ['Int32', 4], ['UInt64', 8], ['Int64', 8] ];
  var tests = toTest.map(tt => {
    return meta.sizeType(tt[0]).then(f => {
      t.equal(typeof f, 'function', `returns a function for ${tt[0]}.`);
      t.equal(f(), tt[1], `has expected value of ${tt[1]} for ${tt[0]}`);
    });
  });
  Promise.all(tests).then(() => { t.end(); }, t.fail);
});

tape('Test read integer values', t => {
  var b = new Buffer.from([128, 2, 3, 4, 5, 6, 0, 0]);
  var toTest = [ ['UInt8', 0x80], ['Int8', -0x80],
    ['UInt16', 0x8002], ['Int16', -0x8000 + 2],
    ['UInt32', 0x80020304], ['Int32', -0x80000000+0x20304] ];
  var tests = toTest.map(tt => {
    return meta.readType(tt[0]).then(f => {
      t.equal(typeof f, 'function', `returns a function for ${tt[0]}.`);
      t.equal(f(b, 0), tt[1], `has expected value of ${tt[1]} for ${tt[0]}`);
    });
  });
  // Javascript bombs out at 48 bits
  tests.push(meta.readType('Int64').then(f => {
    var c = new Buffer.from([0xff, 0xff, 128, 2, 3, 4, 5, 6]);
    t.equal(typeof f, 'function', 'returns a function for Int64.');
    t.equal(f(c, 0), -0x800000000000+0x203040506, `has expected value of Int64 for ${-0x800000000000+0x203040506}`);
  }));
  tests.push(meta.readType('UInt64').then(f => {
    var c = new Buffer.from([0, 0, 128, 2, 3, 4, 5, 6]);
    t.equal(typeof f, 'function', 'returns a function for Int64.');
    t.equal(f(c, 0), 0x800203040506, `has expected value of UInt64 for ${0x800203040506}`);
  }));
  Promise.all(tests).then(() => { t.end(); }, t.fail);
});

tape('Test get pack order', t => {
  var parentPO = null;
  meta.getPackOrder('PartitionPack').then(po => {
    t.ok(Array.isArray(po), 'pack order is defined in PartitionPack.');
    t.equal(po.length, 13, 'pack order is of expected length.');
    parentPO = po;
  }).then(meta.getPackOrder.bind(null, 'HeaderPartitionClosedComplete'))
    .then(hop => {
      t.ok(Array.isArray(hop), 'pack order is defined in HeaderPartitionClosedComplete.');
      t.deepEqual(hop, parentPO, 'is the same in parent and empty child.');
    }).then(() => { t.end(); }, t.fail);
});

function getFns(t) {
  return Promise.all([
    meta.lengthType(t),
    meta.writeType(t),
    meta.sizeType(t),
    meta.readType(t)
  ]).then(x => {
    return { lengthFn : x[0], writeFn: x[1], sizeFn: x[2], readFn: x[3]}; });
}

var toTest = [
  { type: 'UInt8', value: 0x80, length: 1},
  { type: 'Int8', value: -0x80, length: 1},
  { type: 'UInt16', value: 0x8002, length: 2},
  { type: 'Int16', value: -0x8000 + 2, length: 2},
  { type: 'UInt32', value: 0x80020304, length: 4},
  { type: 'Int32', value: -0x80000000+0x20304, length: 4},
  { type: 'UInt64', value: 0x800203040506, length: 8},
  { type: 'Int64', value: -0x203040506070, length: 8},
  { type: 'AUID', value: uuid.v4(), length: 16},
  { type: 'AUID', value: 'UncompressedPictureCodingInterleaved422YCbYCr8Bit', length: 16 },
  { type: 'LocalTagEntry', value: { LocalTag: 4321, UID: uuid.v4() }, length: 18},
  { type: 'TimeStamp', value: '2017-10-22T19:24:27.204Z', length: 8}, // force millis divide by 4
  { type: 'PackageIDType', value: [ uuid.v4(), uuid.v4() ], length: 32} ,
  { type: 'VersionType', value: [4, 2], length: 2},
  { type: 'Rational', value: [ -1234567, 7654321 ], length: 8},
  { type: 'IndexEntry', value: {
    TemporalOffset: 42,
    KeyFrameOffset: -42,
    Flags: 0x7f,
    StreamOffset: 9876543210
  }, length: 11},
  { type: 'DeltaEntry', value: {
    PosTableIndex: -42,
    Slice: 47,
    ElementDelta: 543210
  }, length: 6},
  { type: 'RandomIndexItem', value: {
    BodySID: 24,
    ByteOffset: 8765567890
  }, length: 12},
  { type: 'LocalTagEntryBatch', value: [
    { LocalTag: 43210, UID: uuid.v4() },
    { LocalTag: 65535, UID: uuid.v4() },
    { LocalTag: 42, UID: uuid.v4() }
  ], length: 3 * 18 + 8},
  { type: 'RandomIndexItemArray', value: [
    { BodySID: 24, ByteOffset: 8765567890},
    { BodySID: 42, ByteOffset: 27}
  ], length: 24},
  { type: 'DeltaEntryArray', value: [
    { PosTableIndex: -42, Slice: 47, ElementDelta: 54321 },
    { PosTableIndex: 1, Slice: 3, ElementDelta: 543210 },
    { PosTableIndex: 42, Slice: 1, ElementDelta: 5432100 },
    { PosTableIndex: 69, Slice: 9, ElementDelta: 54321000 }
  ], length: 8 + 6 * 4},
  { type: 'PackageStrongReference', value: uuid.v4(), length: 16},
  { type: 'DataDefinitionWeakReference', value: uuid.v4(), length: 16},
  { type: 'DataDefinitionWeakReference', value: 'PictureEssenceTrack', length: 16 },
  { type: 'UTF16String', value: 'To be or not to be?', length: 19 * 2},
  { type: 'LengthType', value: 56785678, length: 8 },
  { type: 'LayoutType', value: 'SeparateFields', length: 1},
  { type: 'UInt8Array8', value: new Buffer.from([42, 43, 44, 45, 46, 47, 48, 49]),
    length: 8 },
  { type: 'ColorPrimariesType', value: uuid.v4(), length: 16 },
  { type: 'ColorPrimariesType', value: 'ColorPrimaries_SMPTE170M', length: 16 }
];

tape('Test roundtrip values', t => {
  var tests = toTest.map(tt => {
    return getFns(tt.type).then(fns => {
      t.equal(typeof fns.lengthFn, 'function', `length function for ${tt.type} is a function.`);
      t.equal(fns.lengthFn(tt.value), tt.length, `for a ${tt.type}, length is ${tt.length} as expected.`);
      var buf = Buffer.allocUnsafe(fns.lengthFn(tt.value) + ((tt.type === 'RandomIndexItemArray') ? 4 : 0)); // extra 4 bytes for random index item array tests
      t.equal(typeof fns.writeFn, 'function', `write function for ${tt.type} is a function.`);
      t.equal(fns.writeFn(tt.value, buf, 0), tt.length, `write function for ${tt.type} writes ${tt.length} bytes.`);

      t.equal(typeof fns.sizeFn, 'function', `size function for ${tt.type} is a function.`);
      t.equal(fns.sizeFn(buf, 0), tt.length, `size function for ${tt.type} has expected length of ${tt.length}.`);
      t.equal(typeof fns.readFn, 'function', `read function for ${tt.type} is a function.`);
      t.deepEqual(fns.readFn(buf, 0, buf.length), tt.value, `read function for ${tt.type} roundtrips value.`);
    });
  });
  Promise.all(tests).then(() => { t.end(); }, t.fail);
});

tape('Pushing the 48-bit boundary of Javascript UInt64 representation', t => {
  var tests = [];
  tests.push(getFns('UInt64').then(fns => {
    var b = Buffer.allocUnsafe(8);
    t.doesNotThrow(() => fns.writeFn(0xffffffffffff, b, 0), 'does not throw writing max UInt48 value.');
    t.equal(fns.readFn(b, 0), 0xffffffffffff, 'reads maximum UInt48.');
    b[1] = 0x01;
    t.throws(() => fns.readFn(b, 0), /larger/, 'throws on reading a UInt48 value that exceeds max.');
    // t.throws(() => fns.writeFn(0x1000000000000, b, 0), /value/, 'throws on writing a UInt48 value too large.');
    // t.throws(() => fns.writeFn(-1, b, 0), /value/, 'throws on writing a UInt48 value too small.');
  }));
  tests.push(getFns('Int64').then(fns => {
    var b = Buffer.allocUnsafe(8);
    t.doesNotThrow(() => fns.writeFn(0x7fffffffffff, b, 0), 'does not throw writing max Int48 value.');
    t.equal(fns.readFn(b, 0), 0x7fffffffffff, 'reads maximum UInt48.');
    t.doesNotThrow(() => fns.writeFn(-0x800000000000, b, 0), 'does not throw writing min Int48 value.');
    t.equal(fns.readFn(b, 0), -0x800000000000, 'reads minimum UInt48.');
    b[1] = 0x01;
    t.throws(() => fns.readFn(b, 0), /larger/, 'throws on reading a Int48 value that exceeds limit.');
    t.throws(() => fns.writeFn(0x800000000000, b, 0), /value/, 'throws on writing a Int48 value too large.');
    t.throws(() => fns.writeFn(-0x800000000001, b, 0), /value/, 'throws on writing a Int48 value too small.');
  }));
  Promise.all(tests).then(() => { t.end(); }, t.fail);
});
