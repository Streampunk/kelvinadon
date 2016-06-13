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
var uuid = require('uuid');

var metaDictByID = [];
var metaDictByName = [];
var primer = {};

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
    MetaType: "ClassDefinition"
    // Track: id.slice(trackStart),
    // ItemType: id.slice(trackStart, trackStart + 2),
    // ElementType: id.slice(trackStart + 4, trackStart + 6),
    // ElementCount: id.slice(trackStart + 2, trackStart + 4),
    // ElementNumber: id.slice(trackStart + 6)
  };
}

var readingFns = {
  "TypeDefinitionInteger": function (def) {
    return function (offset) {
      return (def.IsSigned) ?
        this.readIntBE(offset, def.Size) :
        this.readUIntBE(offset, def.Size);
    };
  },
  "TypeDefinitionRecord": function (def) {
    switch (def.Symbol) {
      case "AUID":
        return function (pos) {
          return uuid.unparse(this.slice(pos, pos + 16));
        };
      case "LocalTagEntry":
        return function (pos) {
          return {
            LocalTag: this.readUInt16BE(pos),
            UID: uuid.unparse(this.slice(pos + 2, pos + 18))
          };
        };
      case "TimeStamp":
        return function (pos) {
          var year = this.readInt16BE(pos + 0);
          var month = this.readUInt8(pos + 2);
          var day = this.readUInt8(pos + 3);
          var hour = this.readUInt8(pos + 4);
          var min = this.readUInt8(pos + 5);
          var sec = this.readUInt8(pos + 6);
          var msec = this.readUInt8(pos + 7) * 4;
          return (new Date(year, month, day, hour, min, sec, msec)).toISOString();
        }
      case "PackageIDType":
        return function (pos) {
          return [
            uuid.unparse(this.slice(pos, pos + 16)),
            uuid.unparse(this.slice(pos + 16, pos + 32))];
        }
      case "VersionType":
        return function (pos) {
          return [ this.readUInt8(pos), this.readUInt8(pos + 1) ];
        }
      case "Rational":
        return function (pos) {
          return [ this.readInt32BE(pos), this.readInt32BE(pos + 4) ];
        }
      case "IndexEntry":
        return function (pos) {
          return {
            TemporalOffset: this.readInt8(pos),
            KeyFrameOffset: this.readInt8(pos + 1),
            Flags: this.readUInt8(pos + 2),
            StreamOffset: this.readUIntBE(pos + 3, 8)
          };
        }
      case "DeltaEntry":
        return function (pos) {
          return {
            PosTableIndex: this.readInt8(pos),
            Slice: this.readUInt8(pos + 1),
            ElementDelta: this.readUInt32BE(pos + 2)
          };
        }
      case "RandomIndexItem":
        return function (pos) {
          return {
            BodySID: this.readUInt32BE(pos),
            ByteOffset: this.readUIntBE(pos + 4, 8)
          };
        }
      default:
        return function () { return undefined; }
    }
  },
  "TypeDefinitionSet": function (def) {
    return function (pos) {
      var items = this.readUInt32BE(pos);
      var each = this.readUInt32BE(pos + 4);
      var elType = internalResolveByName("TypeDefinition", def.ElementType);
      var elementFn = readingFns[elType.MetaType](elType);
      var set = [];
      for ( var i = 0 ; i < items ; i++ ) {
        set.push(elementFn.call(this, pos + 8 + i * each));
      };
      return set;
    };
  },
  "TypeDefinitionVariableArray": function (def) {
    if (def.Symbol === 'RandomIndexItemArray') {
      return function (pos) {
        var items = (this.length - pos - 4) / 12;
        var elType = internalResolveByName("TypeDefinition", "RandomIndexItem");
        var elementFn = readingFns[elType.MetaType](elType);
        var set = [];
        for ( var i = 0 ; i < items ; i++ ) {
          set.push(elementFn.call(this, pos + i * 12));
        };
        return set;
      };
    } else {
      return function (pos) {
        var items = this.readUInt32BE(pos);
        var each = this.readUInt32BE(pos + 4);
        var elType = internalResolveByName("TypeDefinition", def.ElementType);
        var elementFn = readingFns[elType.MetaType](elType);
        var set = [];
        for ( var i = 0 ; i < items ; i++ ) {
          set.push(elementFn.call(this, pos + 8 + i * each));
        };
        return set;
      };
    }
  },
  "TypeDefinitionStrongObjectReference": function (def) {
    return function (pos) {
      return uuid.unparse(this.slice(pos, pos + 16));
    };
  },
  "TypeDefinitionWeakObjectReference": function (def) {
    return function (pos) {
      return uuid.unparse(this.slice(pos, pos + 16));
    };
  },
  "TypeDefinitionString": function (def) {
    return function (pos, length) {
      var utf16be = this.slice(pos, pos + length);
      var utf16le = new Buffer(length);
      for ( var x = 0 ; x < length ; x += 2 ) {
        utf16le.writeUInt16LE(utf16be.readUInt16BE(x), x);
      }
      return utf16le.toString('utf16le');
    }
  },
  "TypeDefinitionRename": function (def) {
    var elType = internalResolveByName("TypeDefinition", def.RenamedType);
    return readingFns[elType.MetaType](elType);
  },
  "TypeDefinitionEnumeration": function (def) {
    return function (pos) {
      switch (def.Symbol) {
      case "Boolean":
        return this.readInt8(pos) === 1;
      default:
        var fnName = 'read' + def.ElementType +
          ((def.ElementType.endsWith('Int8')) ? '' : 'BE');
        var enumValue = this[fnName](pos);
        var elIndex = def.Elements.Value.indexOf(`${enumValue}`);
        return (elIndex >= 0) ? def.Elements.Name[elIndex] : '';
      }
    };
  },
  "TypeDefinitionFixedArray": function (def) {
    return function (pos) {
      return this.slice(pos, pos + def.ElementCount);
    } // TODO improve for non UInt8 values
  }
}

var sizingFns = {
  "TypeDefinitionInteger": function (def) {
    return function () { return def.Size; };
  },
  "TypeDefinitionRecord": function (def) { // Cache to be fast
    switch (def.Symbol) {
      case "AUID":
        return function () { return 16; }
      case "LocalTagEntry":
        return function () { return 18; }
      case "RandomIndexItem":
        return function () { return 12; }
    }
  },
  "TypeDefinitionSet": function (def) {
    return function (pos) {
      var items = this.readUInt32BE(pos);
      var each = this.readUInt32BE(pos + 4);
      return 8 + items * each;
    }
  },
  "TypeDefinitionVariableArray": function (def) {
    if (def.Symbol === 'RandomIndexItemArray') {
      return function (pos) {
        return this.length - pos - 4;
      }
    } else {
      return function (pos) {
        var items = this.readUInt32BE(pos);
        var each = this.readUInt32BE(pos + 4);
        return 8 + items * each;
      }
    }
  },
  "TypeDefinitionFixedArray": function (def) {
    return function (pos) {
      return def.ElementCount; // TODO improve for non UInt8 types
    }
  }
}

var resolveByID = function (id) {
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
}

var resolveByName = function (type, name) {
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
}

// For use when already inside a promise
var internalResolveByName = function (type, name) {
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
}

var readType = function (typeName) {
  return resolveByName("TypeDefinition", typeName).then(function (type) {
    if (!readingFns[type.MetaType])
      console.error("Failed to resolve type", type.MetaType);
    return readingFns[type.MetaType](type);
  });
}

var sizeType = function (typeName) {
  return resolveByName("TypeDefinition", typeName).then(function (type) {
    if (!sizingFns[type.MetaType])
      console.error("Failed to resolve type", type.MetaType);
    return sizingFns[type.MetaType](type)
  });
}

var getPackOrder = function (name) {
  return resolveByName("ClassDefinition", name).then(function (def) {
    if (def.PackOrder) return def.PackOrder;
    if (def.ParentClass) return getPackOrder(def.ParentClass);
    return undefined;
  });
}

var resetPrimer = function () {
  primer = {
    // Index Table Segment
    0x3f0b: '060e2b34-0101-0105-0530-040600000000', // IndexEditRate
    0x3f0c: '060e2b34-0101-0105-0702-0103010a0000', // IndexStartPosition
    0x3f0d: '060e2b34-0101-0105-0702-020101020000', // IndexDuration
    0x3f05: '060e2b34-0101-0104-0406-020100000000', // EditUnitByteCount
    0x3f06: '060e2b34-0101-0104-0103-040500000000', // IndexSID
    0x3f07: '060e2b34-0101-0104-0103-040400000000', // BodySID
    0x3f08: '060e2b34-0101-0104-0404-040101000000', // SliceCount
    0x3f0e: '060e2b34-0101-0105-0404-040107000000', // PosTableCount
    0x3f09: '060e2b34-0101-0105-0404-040106000000', // DeltaEntryArray
    0x3f0a: '060e2b34-0101-0105-0404-040205000000', // IndexEntryArray
    0x3f0f: '060e2b34-0101-010a-0406-020400000000', // ExtStartOffset
    0x3f10: '060e2b34-0101-010a-0406-020500000000', // VBEByteCount
  };
}

var addPrimerTag = function (localTag, uid) {
  primer[localTag] = uid;
}

var getPrimerUID = function (localTag) {
  return primer[localTag];
}

module.exports = {
  resolveByID: resolveByID,
  resolveByName: resolveByName,
  getAllIDs: function () {
    return readyDicts.then(function () {
      var ids = [];
      metaDictByID.forEach(function (dict) {
        ids = ids.concat(Object.keys(dict));
      });
      return ids;
    });
  },
  readType: readType,
  sizeType: sizeType,
  getPackOrder: getPackOrder,
  resetPrimer: resetPrimer,
  addPrimerTag: addPrimerTag,
  getPrimerUID: getPrimerUID
};
