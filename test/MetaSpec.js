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

var meta = require('../util/meta.js');
var tape = require('tape');

tape('Test resolve by ID', function (t) {
  meta.resolveByID("060e2b34-0101-0102-0601-010401030000").then(function (def) {
    t.ok(def, "baseline def retrieved.");
    t.equal(def.Name, "Codec", "baseline def has the expected name.");
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.01010102.06010104.01030000",
      "baseline def has the expected identififation");
    t.equal(def.MetaType, "PropertyDefinition",
      "baseline def has expected meta type.");
  })
  .then(meta.resolveByID.bind(meta, "060e2b34-0101-0105-0601-010715000000"))
  .then(function (def) {
    t.ok(def, "mxf def retrieved.");
    t.equal(def.Name, "LocalTagEntry Batch", "mxf def has the expected name.");
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.01010105.06010107.15000000",
      "mxf def has the expected identification.");
    t.equal(def.MetaType, "PropertyDefinition",
      "mxf def has expected meta type.");
    t.end();
  }).catch(t.fail);
});

tape('Test resolve by name', function (t) {
  meta.resolveByName("TypeDefinition", "LocalTagEntryBatch").then(function (def) {
    t.ok(def, "mxf def retrieved.");
    t.equal(def.Name, "LocalTagEntryBatch", "mxf def has expected name.")
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.01010101.0f721102.03000000",
      "mxf def has expected id.");
    t.equal(def.MetaType, "TypeDefinitionSet",
      "mxf def has expected meta type.");
  })
  .then(meta.resolveByName.bind(meta, "ClassDefinition", "PictureDescriptor"))
  .then(function (def) {
    t.ok(def, "baseline def retrieved.");
    t.equal(def.Name, "PictureDescriptor", "baseline def has expected name.");
    t.equal(def.Identification, "urn:smpte:ul:060e2b34.02060101.0d010101.01012700",
      "baseline def has expected id.");
    t.equal(def.MetaType, "ClassDefinition",
      "baseline def has expected meta type.");
    t.end();
  }).catch(t.fail);
});

tape('Test each type', function (t) {
  meta.getAllIDs().then(function (ids) {
    t.ok(Array.isArray(ids) && ids.length > 0, 'list of IDs is an array with entries.');
    return ids;
  })
  .then(function (ids) {
    var tests = ids.map(function (id) {
      return meta.resolveByID(id).then(function (def) {
        t.ok(def, `definition with ${id} exists.`);
        t.equal(typeof def.MetaType, 'string', `definition with ${id} has a meta type.`);
        if (def.MetaType !== 'ExtendibleEnumerationElement') {
          t.equal(typeof def.Name, 'string', `definition with ${id} has a name.`);
          t.equal(typeof def.Symbol, 'string', `definition with ${id} has a symbol.`);
          t.equal(typeof def.Identification, 'string', `definition with ${id} has an identification.`);
        };
        if (def.MetaType === 'PropertyDefinition') {
          return meta.resolveByName("ClassDefinition", def.MemberOf).then(function (mem) {
            t.ok(mem, `property ${def.Name} is a member of a known class.`);
          })
          .then(meta.resolveByName.bind(meta, "TypeDefinition", def.Type))
          .then(function (ref) {
            t.ok(ref, `property ${def.Name} references a known type.`);
          });
        };
        if (def.MetaType === 'ClassDefinition' && def.Parent) {
          return meta.resolveByName("ClassDefinition", def.Parent).then(function (p) {
            t.ok(p, `class ${def.name} references a known parent.`);
          });
        };
      });
    });
    return Promise.all(tests);
  })
  .then(function () { t.end(); }, t.fail);
});

tape('Test matching in by name and by ID', function (t) {
  meta.getAllIDs().then(function (ids) {
    t.ok(Array.isArray(ids) && ids.length > 0, 'list of IDs is an array with entries.');
    return ids;
  })
  .then(function (ids) {
    var tests = ids.map(function (id) {
      return meta.resolveByID(id).then(function (def) {
        if (def.MetaType !== 'ExtendibleEnumerationElement') {
          return meta.resolveByName(
              (def.MetaType.startsWith('Type')) ? 'TypeDefinition' : def.MetaType,
              def.Symbol).then(function (res) {
            t.ok(res, `definition ${def.Identification} is in both.`);
            t.deepEqual(res, def, `definitions for ${def.Identification} match.`);
          });
        };
      });
    });
    return Promise.all(tests);
  })
  .then(function () { t.end(); }, t.fail);

})
