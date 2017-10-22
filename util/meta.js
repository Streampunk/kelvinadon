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

var Promise = require('promise');
var fs = require('fs');
var uuid = require('uuid');

var metaDictByID = [];
var metaDictByName = [];

var readFile = Promise.denodeify(fs.readFile);

var dictFiles = [
  `${__dirname}/../lib/baselineDefsByID.json`,
  `${__dirname}/../lib/baselineDefsByName.json`,
  `${__dirname}/../lib/mxfDefsByID.json`,
  `${__dirname}/../lib/mxfDefsByName.json`];
// TODO additional meta dictionaries via command licenses

var readDicts = Promise.all(dictFiles.map(dict => {
  return readFile(dict, 'utf8').then(JSON.parse);
}));

var readyDicts = readDicts.then(x => {
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
  "TypeDefinitionInteger": def => {
    return (buf, pos) => {
      return (def.IsSigned) ?
        buf.readIntBE(pos, def.Size) :
        buf.readUIntBE(pos, def.Size);
    };
  },
  "TypeDefinitionRecord": def => {
    switch (def.Symbol) {
      case "AUID":
        return (buf, pos) => {
          return uuid.unparse(buf.slice(pos, pos + 16));
        };
      case "LocalTagEntry":
        return (buf, pos) => {
          return {
            LocalTag: buf.readUInt16BE(pos),
            UID: uuid.unparse(buf.slice(pos + 2, pos + 18))
          };
        };
      case "TimeStamp":
        return (buf, pos) => {
          var year = buf.readInt16BE(pos + 0);
          var month = buf.readUInt8(pos + 2) - 1;
          var day = buf.readUInt8(pos + 3);
          var hour = buf.readUInt8(pos + 4);
          var min = buf.readUInt8(pos + 5);
          var sec = buf.readUInt8(pos + 6);
          var msec = buf.readUInt8(pos + 7) * 4;
          return (new Date(Date.UTC(year, month, day, hour, min, sec, msec))).toISOString();
        };
      case "PackageIDType":
        return (buf, pos) => {
          return [
            uuid.unparse(buf.slice(pos, pos + 16)),
            uuid.unparse(buf.slice(pos + 16, pos + 32))];
        };
      case "VersionType":
        return (buf, pos) => {
          return [ buf.readInt8(pos), buf.readInt8(pos + 1) ];
        };
      case "Rational":
        return (buf, pos) => {
          return [ buf.readInt32BE(pos), buf.readInt32BE(pos + 4) ];
        };
      case "IndexEntry":
        return (buf, pos) => {
          return {
            TemporalOffset: buf.readInt8(pos),
            KeyFrameOffset: buf.readInt8(pos + 1),
            Flags: buf.readUInt8(pos + 2),
            StreamOffset: buf.readUIntBE(pos + 3, 8)
          };
        };
      case "DeltaEntry":
        return (buf, pos) => {
          return {
            PosTableIndex: buf.readInt8(pos),
            Slice: buf.readUInt8(pos + 1),
            ElementDelta: buf.readUInt32BE(pos + 2)
          };
        };
      case "RandomIndexItem":
        return (buf, pos) => {
          return {
            BodySID: buf.readUInt32BE(pos),
            ByteOffset: buf.readUIntBE(pos + 4, 8)
          };
        };
      default:
        return () => { return undefined; };
    }
  },
  "TypeDefinitionSet": def => {
    return (buf, pos) => {
      var items = buf.readUInt32BE(pos);
      var each = buf.readUInt32BE(pos + 4);
      var elType = internalResolveByName("TypeDefinition", def.ElementType);
      var elementFn = readingFns[elType.MetaType](elType);
      var set = [];
      for ( var i = 0 ; i < items ; i++ ) {
        set.push(elementFn(buf, pos + 8 + i * each));
      };
      return set;
    };
  },
  "TypeDefinitionVariableArray": def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return (buf, pos) => {
        var items = (buf.length - pos - 4) / 12;
        var elType = internalResolveByName("TypeDefinition", "RandomIndexItem");
        var elementFn = readingFns[elType.MetaType](elType);
        var set = [];
        for ( var i = 0 ; i < items ; i++ ) {
          set.push(elementFn(buf, pos + i * 12));
        };
        return set;
      };
    } else {
      return (buf, pos) => {
        var items = buf.readUInt32BE(pos);
        var each = buf.readUInt32BE(pos + 4);
        var elType = internalResolveByName("TypeDefinition", def.ElementType);
        var elementFn = readingFns[elType.MetaType](elType);
        var set = [];
        for ( var i = 0 ; i < items ; i++ ) {
          set.push(elementFn(buf, pos + 8 + i * each));
        };
        return set;
      };
    }
  },
  "TypeDefinitionStrongObjectReference": def => {
    return (buf, pos) => {
      return uuid.unparse(buf.slice(pos, pos + 16));
    };
  },
  "TypeDefinitionWeakObjectReference": def => {
    return (buf, pos) => {
      return uuid.unparse(buf.slice(pos, pos + 16));
    };
  },
  "TypeDefinitionString": def => {
    return (buf, pos, length) => {
      var utf16be = buf.slice(pos, pos + length);
      var utf16le = Buffer.allocUnsafe(length);
      for ( var x = 0 ; x < length ; x += 2 ) {
        utf16le.writeUInt16LE(utf16be.readUInt16BE(x), x);
      }
      return utf16le.toString('utf16le');
    };
  },
  "TypeDefinitionRename": def => {
    var elType = internalResolveByName("TypeDefinition", def.RenamedType);
    return readingFns[elType.MetaType](elType);
  },
  "TypeDefinitionEnumeration": def => {
    return (buf, pos) => {
      switch (def.Symbol) {
      case "Boolean":
        return buf.readInt8(pos) === 1;
      default:
        var fnName = 'read' + def.ElementType +
          ((def.ElementType.endsWith('Int8')) ? '' : 'BE');
        var enumValue = buf[fnName](pos);
        var elIndex = def.Elements.Value.indexOf(`${enumValue}`);
        return (elIndex >= 0) ? def.Elements.Name[elIndex] : '';
      }
    };
  },
  "TypeDefinitionFixedArray": def => {
    return (buf, pos) => {
      return buf.slice(pos, pos + def.ElementCount);
    } // TODO improve for non UInt8 values
  },
  "TypeDefinitionExtendibleEnumeration": def => {
    return (buf, pos) => {
      return uuid.unparse(buf.slice(pos, pos + 16));
    }
  }
};

var writingFns = {
  "TypeDefinitionInteger": def => {
    return (v, buf, pos) => {
      if (def.IsSigned) {
        buf.writeIntBE(v, pos, def.Size);
      } else {
        buf.writeUIntBE(v, pos, def.Size);
      };
      return def.Size;
    }
  },
  "TypeDefinitionRecord": def => {
    switch (def.Symbol) {
    case "AUID":
      return (v, buf, pos) => {
        return writeUUID(v, buf, pos);
      };
    case "LocalTagEntry":
      return (v, buf, pos) => {
        buf.writeUInt16BE(v.LocalTag, pos);
        writeUUID(v.UID, buf, pos + 2);
        return 18;
      };
    case "TimeStamp":
      return (v, buf, pos) => {
        var d = new Date(v);
        buf.writeUInt16BE(d.getUTCFullYear(), pos + 0);
        buf.writeUInt8(d.getUTCMonth() + 1, pos + 2);
        buf.writeUInt8(d.getUTCDate(), pos + 3);
        buf.writeUInt8(d.getUTCHours(), pos + 4);
        buf.writeUInt8(d.getUTCMinutes(), pos + 5);
        buf.writeUInt8(d.getUTCSeconds(), pos + 6);
        buf.writeUInt8(d.getUTCMilliseconds() / 4 | 0, pos + 7);
        return 8;
      };
    case "PackageIDType":
      return (v, buf, pos) => {
        writeUUID(v[0], buf, pos + 0);
        writeUUID(v[1], buf, pos + 16);
        return 32;
      };
    case "VersionType":
      return (v, buf, pos) => {
        buf.writeInt8(v[0], pos + 0);
        buf.writeInt8(v[1], pos + 1);
        return 2;
      };
    case "Rational":
      return (v, buf, pos) => {
        buf.writeInt32BE(v[0], pos + 0);
        buf.writeInt32BE(v[1], pos + 4);
        return 8;
      };
    case "IndexEntry":
      return (v, buf, pos) => {
        buf.writeInt8(v.TemporalOffset, pos + 0);
        buf.writeInt8(v.KeyFrameOffset, pos + 1);
        buf.writeUInt8(v.Flags, pos + 2);
        buf.writeUIntBE(v.StreamOffset, pos + 3, 8);
        return 11;
      };
    case "DeltaEntry":
      return (v, buf, pos) => {
        buf.writeInt8(v.PosTableIndex, pos + 0);
        buf.writeUInt8(v.Slice, pos + 1);
        buf.writeUInt32BE(v.ElementDelta, pos + 2);
        return 6;
      };
    case "RandomIndexItem":
      return (v, buf, pos) => {
        buf.writeUInt32BE(v.BodySID, pos + 0),
        buf.writeUIntBE(v.ByteOffset, pos + 4, 8);
        return 12;
      };
    default:
      return () => { return 0; };
    }
  },
  "TypeDefinitionSet": def => {
    return (v, buf, pos) => {
      var start = pos;
      var elType = internalResolveByName("TypeDefinition", def.ElementType);
      var elementFn = writingFns[elType.MetaType](elType);
      var lengthFn = lengthFns[elType.MetaType](elType);
      var each = v.length > 0 ? lengthFn(v[0]) : lengthFn();
      this.writeUInt32BE(v.length, pos + 0);
      this.writeUInt32BE(typeof each === 'number' ? each : 0, pos + 4);
      pos += 8;
      for (let item of v) {
        pos += elementFn(item, buf, pos);
      };
      return start - pos;
    };
  },
  "TypeDefinitionVariableArray": def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return (v, buf, pos) => {
        var elType = internalResolveByName("TypeDefinition", "RandomIndexItem");
        var elementFn = writingFns[elType.MetaType](elType);
        var pos = offset;
        for (let item of v) {
          pos += elementFn(item, buf, pos);
        };
        return v.length * 12;
      };
    } else {
      return (v, buf, pos) => {
        var start = pos;
        var elType = internalResolveByName("TypeDefinition", def.ElementType);
        var elementFn = writingFns[elType.MetaType](elType);
        var lengthFn = lengthFns[elType.MetaType](elType);
        var each = v.length > 0 ? lengthFn(v[0]) : lengthFn();
        this.writeUInt32BE(v.length, pos + 0);
        this.writeUInt32BE(typeof each === 'number' ? each : 0, pos + 4);
        pos += 8;
        for (let item of v) {
          pos += elementFn(item, buf, pos);
        };
        return start - pos;
      };
    };
  },
  "TypeDefinitionStrongObjectReference": def => {
    return (v, buf, pos) => {
      return writeUUID(v, buf, offset);
    };
  },
  "TypeDefinitionWeakObjectReference": def => {
    return (v, buf, pos) => {
      return writeUUID(v, buf, offset);
    };
  },

};

var sizingFns = {
  "TypeDefinitionInteger": def => {
    return () => def.Size;
  },
  "TypeDefinitionRecord": def => { // Cache to be fast
    switch (def.Symbol) {
      case "AUID": return () => 16;
      case "LocalTagEntry": return () => 18;
      case "TimeStamp": return () => 8;
      case "PackageIDType": return () => 32;
      case "VersionType": return () => 2;
      case "Rational": return () => 8;
      case "IndexEntry": return () => 11;
      case "DeltaEntry": return () => 6;
      case "RandomIndexItem": return () => 12;
      defualt: return () => 0;
    }
  },
  "TypeDefinitionSet": def => {
    return (buf, pos) => {
      var items = buf.readUInt32BE(pos);
      var each = buf.readUInt32BE(pos + 4);
      return 8 + items * each;
    }
  },
  "TypeDefinitionVariableArray": def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return (buf, pos) => buf.length - pos - 4;
    } else {
      return (buf, pos) => {
        var items = buf.readUInt32BE(pos);
        var each = buf.readUInt32BE(pos + 4);
        return 8 + items * each;
      };
    }
  },
  "TypeDefinitionFixedArray": def => {
    return () => def.ElementCount; // TODO improve for non UInt8 types
  },
  "TypeDefinitionExtendibleEnumeration": def => {
    return () => 16;
  }
};

var lengthFns = {
  "TypeDefinitionInteger": def => {
    return () => def.Size;
  },
  "TypeDefinitionRecord": def => { // Cache to be fast
    switch (def.Symbol) {
      case "AUID": return () => 16;
      case "LocalTagEntry": return () => 18;
      case "TimeStamp": return () => 8;
      case "PackageIDType": return () => 32;
      case "VersionType": return () => 2;
      case "Rational": return () => 8;
      case "IndexEntry": return () => 11;
      case "DeltaEntry": return () => 6;
      case "RandomIndexItem": return () => 12;
      default: return () => undefined;
    }
  },
  "TypeDefinitionSet": def => {
    return value => {
      if (!value) return undefined;
      var elType = internalResolveByName("TypeDefinition", def.ElementType);
      var elementFn = lengthFns[elType.MetaType](elType);
      var each = value.length > 0 ? elementFn(value[0]) : elementFn();
      return 8 + value.length * (typeof each === 'number' ? each : 0);
    }
  },
  "TypeDefinitionVariableArray": def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return value => {
        if (!value) return undefined;
        return value.length * 12;
      };
    } else {
      return value => {
        if (!value) return undefined;
        var elType = internalResolveByName("TypeDefinition", def.ElementType);
        var elementFn = lengthFns[elType.MetaType](elType);
        var each = value.length > 0 ? elementFn(value[0]) : elementFn();
        return 8 + value.length * (typeof each === 'number' ? each : 0);
      };
    };
  },
  "TypeDefinitionFixedArray": def => {
    return () => def.ElementCount; // TODO improve for non UInt8 types
  },
  "TypeDefinitionExtendibleEnumeration": def => {
    return () => 16;
  }
};

var resolveByID = function (id) {
  if (id.substring(11,13) === '53') {
    id = id.substring(0, 11) + '06' + id.substring(13);
  }
  if (id.startsWith("060e2b34-0102-0101-0d01-0301")) {
    return readyDicts.then(makeEssenceElement.bind(null, id));
  }
  return readyDicts.then(() => {
    for ( var i = 0 ; i < metaDictByID.length ; i++ ) {
      var def = metaDictByID[i][id];
      if (def) return def;
    };
    return undefined;
  });
}

var resolveByName = function (type, name) {
  return readyDicts.then(() => {
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
  return resolveByName("TypeDefinition", typeName).then(type => {
    if (!readingFns[type.MetaType])
      console.error("Failed to resolve type", type.MetaType, typeName);
    return readingFns[type.MetaType](type);
  });
}

var writeType = function (typeName) {
  return resolveByName("TypeDefinition", typeName).then(type => {
    if (!writingFns[type.MetaType])
      console.error("Failed to resolve type", type.MetaType, typeName);
    return writingFns[type.MetaType](type);
  });
}

var sizeType = function (typeName) {
  return resolveByName("TypeDefinition", typeName).then(type => {
    if (!sizingFns[type.MetaType])
      console.error("Failed to resolve type", type.MetaType);
    return sizingFns[type.MetaType](type);
  });
}

var lengthType = function (typeName) {
  return resolveByName("TypeDefinition", typeName).then(type => {
    if (!lengthFns[type.MetaType])
      console.error("Failed to resolve type", type.MetaType);
    return lengthFns[type.MetaType](type);
  });
}

var getPackOrder = function (name) {
  return resolveByName("ClassDefinition", name).then(def => {
    if (def.PackOrder) return def.PackOrder;
    if (def.ParentClass) return getPackOrder(def.ParentClass);
    return undefined;
  });
}

var resetPrimer = function () {
  return {
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

var addPrimerTag = function (primer, localTag, uid) {
  primer[localTag] = uid;
}

var getPrimerUID = function (primer, localTag) {
  return primer[localTag];
}

function ulToUUID (ul) {
  if (ul.startsWith('urn:smpte:ul:')) ul = ul.slice(13);
  return uuid.unparse(new Buffer(ul.replace(/\./g, ''), 'hex'));
}

function writeUUID(u, b, pos) {
  b.hexWrite(u.replace(/-/g, ''), pos);
  return 16;
}

module.exports = {
  resolveByID: resolveByID,
  resolveByName: resolveByName,
  getAllIDs: function () {
    return readyDicts.then(() => {
      var ids = [];
      metaDictByID.forEach(dict => {
        ids = ids.concat(Object.keys(dict));
      });
      return ids;
    });
  },
  readType: readType,
  sizeType: sizeType,
  writeType: writeType,
  lengthType: lengthType,
  getPackOrder: getPackOrder,
  resetPrimer: resetPrimer,
  addPrimerTag: addPrimerTag,
  getPrimerUID: getPrimerUID,
  ulToUUID: ulToUUID,
  writeUUID: writeUUID
};
