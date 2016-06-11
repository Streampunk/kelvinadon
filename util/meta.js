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

var Promise = require('promise');
var fs = require('fs');

var metaDictByID = [];
var metaDictByName = [];

var readFile = Promise.denodeify(fs.readFile);

var dictFiles = [ 'lib/baselineDefsByID.json', 'lib/baselineDefsByName.json',
  'lib/mxfDefsByID.json', 'lib/mxfDefsByName.json'];
// TODO additional meta dictionaries via command licenses

var readDicts = Promise.all(dictFiles.map(function (dict) {
  return readFile(dict, 'utf8').then(JSON.parse);
}));

var readyDicts = readDicts.then(function (x) {
  metaDictByID = [x[0], x[2]];
  metaDictByName = [x[1], x[3]];
}, console.error.bind(null, 'Failed to read a meta dictionary:'));

function makeEssenceElement(id) {
  var trackStart = id.length - 8;
  return {
    Symbol: "EssenceElement",
    Name: "Essence Element",
    Identification: "urn:smpte:ul:060e2b34.01020101.0d010301." + id.slice(trackStart),
    Description: "",
    IsConcrete: true,
    MetaType: "ClassDefinition",
    Track: id.slice(trackStart),
    ItemType: id.slice(trackStart, trackStart + 2),
    ElementType: id.slice(trackStart + 4, trackStart + 6),
    ElementCount: id.slice(trackStart + 2, trackStart + 4),
    ElementNumber: id.slice(trackStart + 6)
  };
}

module.exports = {
  resolveByID: function (id) {
    if (id.substring(11,13) === '53') {
      id = id.substring(0, 11) + '06' + id.substring(13);
    }
    if (id.startsWith("060e2b34-0102-0101-0d01-0301")) {
      return readyDicts.then(makeEssenceElement.bind(null, id));
    }
    return readyDicts.then(function () {
      for ( var i = 0 ; i < metaDictByID.length ; i++ ) {
        var def = metaDictByID[i][id];
        if (def) return def;
      };
      return undefined;
    });
  },
  resolveByName: function (type, name) {
    return readyDicts.then(function () {
      for ( var i = 0; i < metaDictByName.length ; i++ ) {
        if (metaDictByName[i][type]) {
          var def = metaDictByName[i][type][name];
          if (def) {
            return def;
          } else if (name.endsWith('Type')) {
            def = metaDictByName[i][type][name.slice(0, -4)];
            if (def) return def;
          }
        }
      }
      return undefined;
    });
  },
  getAllIDs: function () {
    return readyDicts.then(function () {
      var ids = [];
      metaDictByID.forEach(function (dict) {
        ids = ids.concat(Object.keys(dict));
      });
      return ids;
    });
  }
};
