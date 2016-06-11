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

module.exports = {
  resolveByID: function (id) {
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
