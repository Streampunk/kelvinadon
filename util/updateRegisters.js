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

const xml2js = require('xml2js');
const fs = require('fs');
const H = require('highland');
const ulToUUID = require('./meta.js').ulToUUID;
const zlib = require('zlib');

const groupsURL = 'https://registry.smpte-ra.org/view/published/Groups.xml';
const typesURL = 'https://registry.smpte-ra.org/view/published/Types.xml';
const elementsURL = 'https://registry.smpte-ra.org/view/published/Elements.xml';
const labelsURL = 'https://registry.smpte-ra.org/view/published/Labels.xml';

const http = (groupsURL.startsWith('https')) ? require('https') : require('http');

const gzip = H.wrapCallback(zlib.gzip);
const writeFile = H.wrapCallback(fs.writeFile);

var ulCache = {};
var memberOf = {};
var isOptional = {};
var localID = {};
var isUniqueID = {};

function ulToName (def, symbol, ul) {
  if (ulCache[ul]) { return ulCache[ul].Symbol; }
  console.error(`For ${def}, ${symbol}, unable to resolve UL ${ul}.`);
  return undefined;
}

var readPromise = function(url, register) {
  var parser = new xml2js.Parser();
  var parseString = H.wrapCallback(parser.parseString);
  return new Promise((fulfil, reject) => {
    console.log(`Starting to read ${register} from ${url}.`);
    var g = http.get(url, res => {
      res.setEncoding('utf8');
      res.on('error', reject);
      H(res)
        .reduce1((x, y) => x + y)
        .flatMap(parseString)
        .flatMap(x => H(x[register].Entries[0].Entry))
        .map(x => {
          var y = { };
          Object.keys(x).filter(k => k !== 'Register').forEach(k => {
            y[k] = x[k][0];
          });
          return y;
        })
        .filter(x => x.Kind === 'LEAF')
        .doto(x => ulCache[x.UL] = x)
        .collect()
        .errors(e => reject(e))
        .each(x => fulfil(x))
        .done(() => { console.log(`Finished reading register ${register}.`); });
    });
    g.on('error', reject);
  });
};

function convertLabels (labels) {
  return labels.map(x => ({
    Symbol: x.Symbol,
    Name: x.Name,
    Identification: x.UL,
    UUID: ulToUUID(x.UL),
    Description: x.Definition,
    Kind: x.Kind,
    NamespaceName: x.NamespaceName,
    MetaType: 'LabelDefinition'
  }));
}
function convertGroups (groups) {
  return groups.map(x => {
    var base = {
      Symbol: x.Symbol,
      Name: x.Name,
      Identification: x.UL,
      UUID: ulToUUID(x.UL),
      Description: x.Definition ? x.Definition : '',
      Kind: x.Kind,
      NamespaceName: x.NamespaceName,
      MetaType: 'ClassDefinition',
      ParentClass: x.Parent ? ulToName('ClassDefinition', x.Symbol, x.Parent) : undefined,
      IsConcrete: x.IsConcrete ? (x.IsConcrete === 'true') : undefined,
      KLVSyntax: x.KLVSyntax
    };
    if (x.KLVSyntax === '05' && x.Contents) { // fixed length pack
      base.PackOrder = x.Contents.Record.map(k => ulToName('ClassDefinition', x.Symbol, k.UL));
    }
    if (x.Contents) {
      x.Contents.Record.forEach(k => {
        var prop = ulCache[k.UL];
        if (!prop) { return console.error(`Object ${x.Symbol} has unknown property ${k}.`); }
        if (!memberOf[prop.UL]) {
          memberOf[prop.UL] = [ x.Symbol ];
        } else {
          memberOf[prop.UL].push(x.Symbol);
        }
        if (Array.isArray(k.IsOptional)) {
          if (!isOptional[prop.UL]) {
            isOptional[prop.UL] = (k.IsOptional[0] === 'true');
          } else {
            if (isOptional[prop.UL] !== (k.IsOptional[0] === 'true')) {
              console.error(`Warning: Changing is optional status for property ${prop.Symbol}.`);
            }
          }
        }
        if (Array.isArray(k.IsUniqueID)) {
          if (!isUniqueID[prop.UL]) {
            isUniqueID[prop.UL] = (k.IsUniqueID[0] === 'true');
          } else {
            if (isUniqueID[prop.UL] !== (k.IsUniqueID[0] === 'true')) {
              console.error(`Warning: Changing unique ID status for property ${prop.Symbol}.`);
            }
          }
        }
        if (Array.isArray(k.LocalTag)) {
          var tag = parseInt(k.LocalTag[0], 16);
          if (!localID[prop.UL] || localID[prop.UL] <= 0) {
            localID[prop.UL] = (!isNaN(tag) && tag > 0) ? tag : 0;
          } else {
            if (localID[prop.UL] !== tag)
              console.error(`Warning: Replacing local property tag for ${prop.Symbol}, changing value from ${localID[prop.UL]} to ${tag}.`);
          }
        }
      });
    }
    return base;
  });
}
function convertTypes (types) {
  return types.map(x => {
    var base = {
      Symbol: x.Symbol,
      Name: x.Name,
      Identification: x.UL,
      UUID: ulToUUID(x.UL),
      Description: x.Definition ? x.Definition : '',
      Kind: x.Kind,
      NamespaceName: x.NamespaceName,
      MetaType: 'TypeDefinition' + x.TypeKind
    };
    switch (x.TypeKind) {
    case 'Integer':
      base.Size = +x.TypeSize;
      base.IsSigned = (x.TypeQualifiers.indexOf('isSigned') > 0);
      return base;
    case 'Rename':
      base.RenamedType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    case 'Record':
      base.Members = { Name : [], Type : [] };
      x.Facets.Facet.forEach(y => {
        base.Members.Name.push(y.Symbol[0]);
        base.Members.Type.push(ulToName(base.MetaType, base.Symbol, y.Type[0]));
      });
      return base;
    case 'Character':
      return base;
    case 'String':
      base.ElementType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    case 'Enumeration':
      if (ulToName(base.MetaType, base.Symbol, x.BaseType) === 'AUID') {
        base.MetaType = 'TypeDefinitionExtendibleEnumeration';
        return base;
      }
      base.ElementType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      base.Elements = { Name : [], Value : [] };
      if (x.Facets) {
        x.Facets.Facet.filter(y => y.Name && y.Value).forEach(y => {
          base.Elements.Name.push(y.Symbol[0]);
          base.Elements.Value.push(y.Value[0]);
        });
      }
      return base;
    case 'FixedArray':
      base.ElementCount = +x.TypeSize;
      base.ElementType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    case 'VariableArray':
      base.ElementType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    case 'StrongReference':
      base.ReferencedType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    case 'WeakReference':
      base.ReferencedType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    case 'Set':
      base.ElementType = ulToName(base.MetaType, base.Symbol, x.BaseType);
      return base;
    default:
      return base;
    }
  });
}
function convertElements (elements) {
  return elements.map(x => ({
    Symbol: x.Symbol,
    Name: x.Name,
    Identification: x.UL,
    UUID: ulToUUID(x.UL),
    Description: x.Definition ? x.Definition : '',
    Kind: x.Kind,
    NamespaceName: x.NamespaceName,
    MetaType: 'PropertyDefinition',
    Type: x.Type ? ulToName('PropertyDefinition', x.Symbol, x.Type) : 'UInt8Array',
    MemberOf: memberOf[x.UL],
    LocalIdentification: localID[x.UL],
    IsOptional: isOptional[x.UL],
    IsUniqueIdentifier: isUniqueID[x.UL]
  }) );
}

H(Promise.all([
  readPromise(labelsURL, 'LabelsRegister'),
  readPromise(groupsURL, 'GroupsRegister'),
  readPromise(typesURL, 'TypesRegister'),
  readPromise(elementsURL, 'ElementsRegister'),
]))
  .doto(() => { console.log('Converting types to kelvinadon format.'); })
  .flatMap(a => H([
    convertLabels(a[0]),
    convertGroups(a[1]),
    convertTypes(a[2]),
    convertElements(a[3])
  ]))
  .flatten()
  .collect()
  .map(x => JSON.stringify(x, null, 2)) // White space adds 2.5% to gzip size
  .flatMap(gzip)
  .doto(() => { console.log('Writing definitions to file.'); })
  .flatMap(x => writeFile('./lib/RegDefs.json.gz', x))
  .done(() => { console.log('Finished!'); });
