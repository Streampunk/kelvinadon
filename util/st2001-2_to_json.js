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

var xml2js = require('xml2js');
var fs = require('fs');
var uuid = require('uuid');

var initRead = fs.readFileSync('lib/ST2001-2a-2013.xml');
var parser = new xml2js.Parser();

function ulToUUID (ul) {
  if (ul.startsWith('urn:smpte:ul:')) ul = ul.slice(13);
  return uuid.unparse(new Buffer(ul.replace(/\./g, ''), 'hex'));
}

var metaDefsIDFile = (process.argv[2]) ? process.argv[2] : 'lib/baselineDefsByID.json';
var metaDefsNameFile = (process.argv[3]) ? process.argv[3] : 'lib/baselineDefsByName.json';

parser.parseString(initRead.toString(), function (err, data) {
  if (err) return console.log(err);
  var metaDefsByID = {};
  var metaDefsByName = {
    ClassDefinition : {},
    PropertyDefinition : {},
    TypeDefinition : {},
    ExtendibleEnumerationElement : {}
  };
  var metaDefs = data.Baseline.MetaDefinitions[0];
  var metaTypes = Object.keys(metaDefs);
  metaTypes.forEach(function (type) {
    var metas = metaDefs[type];
    metas.forEach(function (meta) {
      Object.keys(meta).forEach(function (k) {
        if (Array.isArray(meta[k]) && meta[k].length === 1) {
          meta[k] = meta[k][0];
        };
        if (meta[k] === 'true') {
          meta[k] = true;
        } else if (meta[k] === 'false') {
          meta[k] = false;
        } else if (meta[k].length > 0 && !isNaN(+meta[k])) {
          meta[k] = +meta[k];
        };
      });
      meta['MetaType'] = type;
      if (meta.Identification) {
        metaDefsByID[ulToUUID(meta.Identification)] = meta;
      }
      if (meta.Symbol && type.startsWith('TypeDefinition')) {
        metaDefsByName.TypeDefinition[meta.Symbol] = meta;
      } else if (meta.Symbol) {
        metaDefsByName[type][meta.Symbol] = meta;
      } else if (type === 'ExtendibleEnumerationElement') {
        metaDefsByID[ulToUUID(meta.Value)] = meta;
        metaDefsByName.ExtendibleEnumerationElement[meta.Name] = meta;
        if (meta.ElementOf && metaDefsByID[ulToUUID(meta.ElementOf)]) {
          meta.ExtendibleTypeName = metaDefsByID[ulToUUID(meta.ElementOf)].Symbol;
        };
      } else {
        console.error('Not registerting value', meta);
      };
    });
  });

  fs.writeFileSync(metaDefsIDFile, JSON.stringify(metaDefsByID, null, 2));
  fs.writeFileSync(metaDefsNameFile, JSON.stringify(metaDefsByName, null, 2));
});
