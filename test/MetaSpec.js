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

tape('Test resolve by ID', t => {
  meta.resolveByID("060e2b34-0101-0102-0601-010401030000").then(def => {
    t.ok(def, "baseline def retrieved.");
    t.equal(def.Name, "Codec", "baseline def has the expected name.");
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.01010102.06010104.01030000",
      "baseline def has the expected identififation");
    t.equal(def.MetaType, "PropertyDefinition",
      "baseline def has expected meta type.");
  })
  .then(meta.resolveByID.bind(meta, "060e2b34-0101-0105-0601-010715000000"))
  .then(def => {
    t.ok(def, "mxf def retrieved.");
    t.equal(def.Name, "LocalTagEntry Batch", "mxf def has the expected name.");
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.01010105.06010107.15000000",
      "mxf def has the expected identification.");
    t.equal(def.MetaType, "PropertyDefinition",
      "mxf def has expected meta type.");
    t.end();
  }).catch(t.fail);
});

tape('Test resolve by name', t => {
  meta.resolveByName("TypeDefinition", "LocalTagEntryBatch").then(def => {
    t.ok(def, "mxf def retrieved.");
    t.equal(def.Name, "LocalTagEntryBatch", "mxf def has expected name.")
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.01010101.0f721102.03000000",
      "mxf def has expected id.");
    t.equal(def.MetaType, "TypeDefinitionSet",
      "mxf def has expected meta type.");
  })
  .then(meta.resolveByName.bind(meta, "ClassDefinition", "PictureDescriptor"))
  .then(def => {
    t.ok(def, "baseline def retrieved.");
    t.equal(def.Name, "PictureDescriptor", "baseline def has expected name.");
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.02060101.0d010101.01012700",
      "baseline def has expected id.");
    t.equal(def.MetaType, "ClassDefinition",
      "baseline def has expected meta type.");
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
        t.equal(typeof def.MetaType, 'string', `definition with ${id} has a meta type.`);
        if (def.MetaType !== 'ExtendibleEnumerationElement') {
          t.equal(typeof def.Name, 'string', `definition with ${id} has a name.`);
          t.equal(typeof def.Symbol, 'string', `definition with ${id} has a symbol.`);
          t.equal(typeof def.Identification, 'string', `definition with ${id} has an identification.`);
        };
        if (def.MetaType === 'PropertyDefinition') {
          return meta.resolveByName("ClassDefinition", def.MemberOf).then(mem => {
            t.ok(mem, `property ${def.Name} is a member of a known class.`);
          })
          .then(meta.resolveByName.bind(meta, "TypeDefinition", def.Type))
          .then(ref => {
            t.ok(ref, `property ${def.Name} references a known type.`);
          });
        };
        if (def.MetaType === 'ClassDefinition' && def.Parent) {
          return meta.resolveByName("ClassDefinition", def.Parent).then(p => {
            t.ok(p, `class ${def.name} references a known parent.`);
          });
        };
      });
    });
    return Promise.all(tests);
  })
  .then(() => { t.end(); }, t.fail);
});

tape('Test matching in by name and by ID', t => {
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
            t.deepEqual(res, def, `definitions for ${def.Identification} match.`);
          });
        };
      });
    });
    return Promise.all(tests);
  })
  .then(() => { t.end(); }, t.fail);
});

tape('Test get integer sizes', t => {
  var toTest = [ ["UInt8", 1], ["Int8", 1], ["UInt16", 2], ["Int16", 2],
    ["UInt32", 4], ["Int32", 4], ["UInt64", 8], ["Int64", 8] ];
  var tests = toTest.map(tt => {
    return meta.sizeType(tt[0]).then(f => {
      t.equal(typeof f, 'function', `returns a function for ${tt[0]}.`);
      t.equal(f(), tt[1], `has expected value of ${tt[1]} for ${tt[0]}`);
    });
  });
  Promise.all(tests).then(() => { t.end(); }, t.fail);
});

tape('Test read integer values', t => {
  var b = new Buffer([128, 2, 3, 4, 5, 6, 7, 8]);
  var toTest = [ ["UInt8", 0x80], ["Int8", -0x80],
    ["UInt16", 0x8002], ["Int16", -0x8000 + 2],
    ["UInt32", 0x80020304], ["Int32", -0x80000000+0x20304],
    ["UInt64", 0x8002030405060708], ["Int64", -0x8000000000000000+0x2030405060708] ];
  var tests = toTest.map(tt => {
    return meta.readType(tt[0]).then(f => {
      t.equal(typeof f, 'function', `returns a function for ${tt[0]}.`);
      t.equal(f(b, 0), tt[1], `has expected value of ${tt[1]} for ${tt[0]}`);
    });
  });
  Promise.all(tests).then(() => { t.end(); }, t.fail);
});

tape('Test get pack order', t => {
  var parentPO = null;
  meta.getPackOrder('PartitionPack').then(po => {
    t.ok(Array.isArray(po), 'pack order is defined in PartitionPack.');
    t.equal(po.length, 13, 'pack order is of expected length.');
    parentPO = po;
  }).then(meta.getPackOrder.bind(null, 'HeaderClosedCompletePartitionPack'))
  .then(hop => {
    t.ok(Array.isArray(hop), 'pack order is defined in HeaderClosedCompletePartitionPack.');
    t.deepEqual(hop, parentPO, 'is the same in parent and empty child.');
  }).then(() => { t.end() }, t.fail);
});
