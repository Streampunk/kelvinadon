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

const fs = require('fs');
const uuid = require('uuid');
const zlib = require('zlib');
const util = require('util');
const promisify = util.promisify ? util.promisify : require('util.promisify');

const uuidPattern = /(urn:uuid:)?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const nilUUID = '00000000-0000-0000-0000-000000000000';

var metaDictByID = {};
var metaDictByName = {
  ClassDefinition: {},
  TypeDefinition: {},
  PropertyDefinition: {},
  LabelDefinition: {}
};
var shadowPrimer = null;

const readFile = promisify(fs.readFile);
const gunzip = promisify(zlib.gunzip);

var dictFiles = [
  `${__dirname}/../lib/RegDefs.json.gz`,
  `${__dirname}/../lib/OverrideDefs.json`,
  `${__dirname}/../lib/ExtensionDefs.json`
];

// Measured load time approx 50ms, hash build time 14ms

var readDicts = Promise.all(dictFiles.map(dict => {
  // var readStart = process.hrtime();
  return readFile(dict)
    .then(b => dict.endsWith('.gz') ? gunzip(b) : b)
    .then(x => {
      var defs = JSON.parse(x.toString('utf8'));
      // console.log(`Reading file ${dict} took ${process.hrtime(readStart)[1]/1000000}.`);
      return defs;
    });
}));

var readyDicts = readDicts.then(dicts => {
  // var makeDictStart = process.hrtime();
  for ( var dict of dicts ) {
    for ( let def of dict ) {
      if (def.Symbol.startsWith('EssenceElement')) console.log(def);
      metaDictByID[def.UUID] = def;
      if (def.Symbol && def.MetaType) {
        if (def.MetaType && def.MetaType.startsWith('TypeDefinition')) {
          metaDictByName.TypeDefinition[def.Symbol] = def;
        } else {
          metaDictByName[def.MetaType][def.Symbol] = def;
        }
      } else {
        console.error(`Found a definition ${def.Identification} without symbol and meta type.`);
      }
    }
  }
  // console.log(`Making dictionary lookup took ${process.hrtime(makeDictStart)[1]/1000000}.`);
}, console.error.bind(null, 'Failed to read a meta dictionary:'));

function makeEssenceElement(id) {
  var idEnd = id.slice(-8);
  return {
    Symbol: 'EssenceElement',
    Name: 'Essence Element',
    Identification: 'urn:smpte:ul:060e2b34.01020101.0d010301.' + idEnd,
    Description: '',
    IsConcrete: true,
    MetaType: 'ClassDefinition',
    KLVSyntax: '02',
    Kind: idEnd === '00000000' ? 'NODE' : 'LEAF',
    UUID: '060e2b34-0102-0101-0d01-0301' + idEnd
  };
}

var readingFns = {
  'TypeDefinitionInteger': def => {
    return (buf, pos) => {
      return (def.IsSigned) ?
        readIntBE(buf, pos, def.Size) :
        readUIntBE(buf, pos, def.Size);
    };
  },
  'TypeDefinitionRecord': def => {
    switch (def.Symbol) {
    case 'AUID':
      return (buf, pos) => {
        var labelID = uuid.unparse(buf.slice(pos, pos + 16));
        var label = internalResolveByID(labelID);
        return label ? label.Symbol : labelID;
      };
    case 'LocalTagEntry':
      return (buf, pos) => {
        return {
          LocalTag: buf.readUInt16BE(pos),
          UID: uuid.unparse(buf.slice(pos + 2, pos + 18))
        };
      };
    case 'TimeStamp':
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
    case 'PackageIDType':
      return (buf, pos) => {
        return [
          uuid.unparse(buf.slice(pos, pos + 16)),
          uuid.unparse(buf.slice(pos + 16, pos + 32))];
      };
    case 'VersionType':
      return (buf, pos) => {
        return [ buf.readInt8(pos), buf.readInt8(pos + 1) ];
      };
    case 'Rational':
      return (buf, pos) => {
        return [ buf.readInt32BE(pos), buf.readInt32BE(pos + 4) ];
      };
    case 'IndexEntry':
      return (buf, pos) => {
        return {
          TemporalOffset: buf.readInt8(pos),
          KeyFrameOffset: buf.readInt8(pos + 1),
          Flags: buf.readUInt8(pos + 2),
          StreamOffset: buf.readUIntBE(pos + 3, 8)
        };
      };
    case 'DeltaEntry':
      return (buf, pos) => {
        return {
          PosTableIndex: buf.readInt8(pos),
          Slice: buf.readUInt8(pos + 1),
          ElementDelta: buf.readUInt32BE(pos + 2)
        };
      };
    case 'RandomIndexItem':
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
  'TypeDefinitionSet': def => {
    return (buf, pos) => {
      var items = buf.readUInt32BE(pos);
      var each = buf.readUInt32BE(pos + 4);
      var elType = internalResolveByName('TypeDefinition', def.ElementType);
      var elementFn = readingFns[elType.MetaType](elType);
      var set = [];
      for ( var i = 0 ; i < items ; i++ ) {
        set.push(elementFn(buf, pos + 8 + i * each));
      }
      return set;
    };
  },
  'TypeDefinitionVariableArray': def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return (buf, pos) => {
        var items = (buf.length - pos - 4) / 12;
        var elType = internalResolveByName('TypeDefinition', 'RandomIndexItem');
        var elementFn = readingFns[elType.MetaType](elType);
        var set = [];
        for ( var i = 0 ; i < items ; i++ ) {
          set.push(elementFn(buf, pos + i * 12));
        }
        return set;
      };
    } else {
      return (buf, pos) => {
        var items = buf.readUInt32BE(pos);
        var each = buf.readUInt32BE(pos + 4);
        var elType = internalResolveByName('TypeDefinition', def.ElementType);
        var elementFn = readingFns[elType.MetaType](elType);
        var set = [];
        for ( var i = 0 ; i < items ; i++ ) {
          set.push(elementFn(buf, pos + 8 + i * each));
        }
        return set;
      };
    }
  },
  'TypeDefinitionStrongReference': () => {
    return (buf, pos) => {
      return uuid.unparse(buf.slice(pos, pos + 16));
    };
  },
  'TypeDefinitionWeakReference': () => {
    return (buf, pos) => {
      var labelID = uuid.unparse(buf.slice(pos, pos + 16));
      var label = internalResolveByID(labelID);
      return label ? label.Symbol : labelID;
    };
  },
  'TypeDefinitionString': def => {
    switch (def.ElementType) {
    case 'UTF8Character':
      return (buf, pos, length) => {
        return buf.slice(pos, pos+length).toString('utf8');
      };
    default:
    case 'Character':
      return (buf, pos, length) => {
        var utf16be = buf.slice(pos, pos + length);
        var utf16le = Buffer.allocUnsafe(utf16be.length);
        for ( var x = 0 ; x < length ; x += 2 ) {
          utf16le.writeUInt16LE(utf16be.readUInt16BE(x), x);
        }
        return utf16le.toString('utf16le');
      };
    }
  },
  'TypeDefinitionRename': def => {
    var elType = internalResolveByName('TypeDefinition', def.RenamedType);
    return readingFns[elType.MetaType](elType);
  },
  'TypeDefinitionEnumeration': def => {
    return (buf, pos) => {
      switch (def.Symbol) {
      case 'Boolean':
        return buf.readInt8(pos) === 1;
      default:
        var elType = internalResolveByName('TypeDefinition', def.ElementType);
        var enumValue = (elType.IsSigned) ?
          readIntBE(buf, pos, elType.Size) :
          readUIntBE(buf, pos, elType.Size);
        var elIndex = def.Elements.Value.indexOf(`${enumValue}`);
        return (elIndex >= 0) ? def.Elements.Name[elIndex] : '';
      }
    };
  },
  'TypeDefinitionFixedArray': def => {
    switch (def.Symbol) {
    case 'UUID':
      return (buf, pos) => {
        return uuid.unparse(buf.slice(pos, pos + 16));
      };
    default:
      return (buf, pos) => {
        return buf.slice(pos, pos + def.ElementCount);
      };
    }
  },
  'TypeDefinitionExtendibleEnumeration': () => {
    return (buf, pos) => {
      var labelID = uuid.unparse(buf.slice(pos, pos + 16));
      var label = internalResolveByID(labelID);
      return label ? label.Symbol : labelID;
    };
  }
};

var writingFns = {
  'TypeDefinitionInteger': def => {
    return (v, buf, pos) => {
      if (def.IsSigned) {
        writeIntBE(v, buf, pos, def.Size);
      } else {
        writeUIntBE(v, buf, pos, def.Size);
      }
      return def.Size;
    };
  },
  'TypeDefinitionRecord': def => {
    switch (def.Symbol) {
    case 'AUID':
      return (v, buf, pos) => {
        if (!v.match(uuidPattern)) {
          let label = internalResolveByName('LabelDefinition', v);
          return writeUUID(label ? label.UUID : nilUUID, buf, pos);
        }
        return writeUUID(v, buf, pos);
      };
    case 'LocalTagEntry':
      return (v, buf, pos) => {
        buf.writeUInt16BE(v.LocalTag, pos);
        writeUUID(v.UID, buf, pos + 2);
        return 18;
      };
    case 'TimeStamp':
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
    case 'PackageIDType':
      return (v, buf, pos) => {
        writeUUID(v[0], buf, pos + 0);
        writeUUID(v[1], buf, pos + 16);
        return 32;
      };
    case 'VersionType':
      return (v, buf, pos) => {
        buf.writeInt8(v[0], pos + 0);
        buf.writeInt8(v[1], pos + 1);
        return 2;
      };
    case 'Rational':
      return (v, buf, pos) => {
        buf.writeInt32BE(v[0], pos + 0);
        buf.writeInt32BE(v[1], pos + 4);
        return 8;
      };
    case 'IndexEntry':
      return (v, buf, pos) => {
        buf.writeInt8(v.TemporalOffset, pos + 0);
        buf.writeInt8(v.KeyFrameOffset, pos + 1);
        buf.writeUInt8(v.Flags, pos + 2);
        buf.writeUIntBE(v.StreamOffset, pos + 3, 8);
        return 11;
      };
    case 'DeltaEntry':
      return (v, buf, pos) => {
        buf.writeInt8(v.PosTableIndex, pos + 0);
        buf.writeUInt8(v.Slice, pos + 1);
        buf.writeUInt32BE(v.ElementDelta, pos + 2);
        return 6;
      };
    case 'RandomIndexItem':
      return (v, buf, pos) => {
        buf.writeUInt32BE(v.BodySID, pos + 0),
        buf.writeUIntBE(v.ByteOffset, pos + 4, 8);
        return 12;
      };
    default:
      return () => { return 0; };
    }
  },
  'TypeDefinitionSet': def => {
    return (v, buf, pos) => {
      var start = pos;
      var elType = internalResolveByName('TypeDefinition', def.ElementType);
      var elementFn = writingFns[elType.MetaType](elType);
      var lengthFn = lengthFns[elType.MetaType](elType);
      var each = v.length > 0 ? lengthFn(v[0]) : lengthFn();
      buf.writeUInt32BE(v.length, pos + 0);
      buf.writeUInt32BE(typeof each === 'number' ? each : 0, pos + 4);
      pos += 8;
      for (let item of v) {
        pos += elementFn(item, buf, pos);
      }
      return pos - start;
    };
  },
  'TypeDefinitionVariableArray': def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return (v, buf, pos) => {
        var start = pos;
        var elType = internalResolveByName('TypeDefinition', 'RandomIndexItem');
        var elementFn = writingFns[elType.MetaType](elType);
        for (let item of v) {
          pos += elementFn(item, buf, pos);
        }
        return pos - start;
      };
    } else {
      return (v, buf, pos) => {
        var start = pos;
        var elType = internalResolveByName('TypeDefinition', def.ElementType);
        var elementFn = writingFns[elType.MetaType](elType);
        var lengthFn = lengthFns[elType.MetaType](elType);
        var each = v.length > 0 ? lengthFn(v[0]) : lengthFn();
        buf.writeUInt32BE(v.length, pos + 0);
        buf.writeUInt32BE(typeof each === 'number' ? each : 0, pos + 4);
        pos += 8;
        for (let item of v) {
          pos += elementFn(item, buf, pos);
        }
        return pos - start;
      };
    }
  },
  'TypeDefinitionStrongReference': () => {
    return (v, buf, pos) => {
      return writeUUID(v, buf, pos);
    };
  },
  'TypeDefinitionWeakReference': () => {
    return (v, buf, pos) => {
      if (!v.match(uuidPattern)) {
        let label = internalResolveByName('LabelDefinition', v);
        return writeUUID(label ? label.UUID : nilUUID, buf, pos);
      }
      return writeUUID(v, buf, pos);
    };
  },
  'TypeDefinitionString': def => {
    switch (def.ElementType) {
    case 'UTF8Character':
      return (v, buf, pos) => {
        var utf8 = Buffer.from(v, 'utf8');
        return utf8.copy(buf, pos);
      };
    default:
    case 'Character':
      return (v, buf, pos) => {
        var utf16le = Buffer.from(v, 'utf16le');
        for ( var i = 0 ; i < utf16le.length ; i += 2) {
          buf.writeUInt16BE(utf16le.readUInt16LE(i), pos + i);
        }
        return utf16le.length;
      };
    }
  },
  'TypeDefinitionRename': def => {
    var elType = internalResolveByName('TypeDefinition', def.RenamedType);
    return writingFns[elType.MetaType](elType);
  },
  'TypeDefinitionEnumeration': def => {
    return (v, buf, pos) => {
      switch (def.Symbol) {
      case 'Boolean':
        buf.writeInt8(v === true ? 1 : 0, pos);
        return 1;
      default:
        var elType = internalResolveByName('TypeDefinition', def.ElementType);
        var elIndex = def.Elements.Name.indexOf(v);
        var enumValue = (elIndex >= 0) ? +def.Elements.Value[elIndex] : 0;
        return (elType.IsSigned) ?
          writeIntBE(enumValue, buf, pos, elType.Size) - pos :
          writeUIntBE(enumValue, buf, pos, elType.Size) - pos;
      }
    };
  },
  'TypeDefinitionFixedArray': def => {
    switch (def.Symbol) {
    case 'UUID':
      return (v, buf, pos) => {
        return writeUUID(v, buf, pos);
      };
    default:
      return (v, buf, pos) => {
        return v.copy(buf, pos);
      };
    }
  },
  'TypeDefinitionExtendibleEnumeration': () => {
    return (v, buf, pos) => {
      if (!v.match(uuidPattern)) {
        let label = internalResolveByName('LabelDefinition', v);
        return writeUUID(label ? label.UUID : nilUUID, buf, pos);
      }
      return writeUUID(v, buf, pos);
    };
  }
};

var sizingFns = {
  'TypeDefinitionInteger': def => {
    return () => def.Size;
  },
  'TypeDefinitionRecord': def => { // Cache to be fast
    switch (def.Symbol) {
    case 'AUID': return () => 16;
    case 'LocalTagEntry': return () => 18;
    case 'TimeStamp': return () => 8;
    case 'PackageIDType': return () => 32;
    case 'VersionType': return () => 2;
    case 'Rational': return () => 8;
    case 'IndexEntry': return () => 11;
    case 'DeltaEntry': return () => 6;
    case 'RandomIndexItem': return () => 12;
    default: return () => 0;
    }
  },
  'TypeDefinitionSet': () => {
    return (buf, pos) => {
      var items = buf.readUInt32BE(pos);
      var each = buf.readUInt32BE(pos + 4);
      return 8 + items * each;
    };
  },
  'TypeDefinitionVariableArray': def => {
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
  'TypeDefinitionFixedArray': def => {
    return () => def.ElementCount; // TODO improve for non UInt8 types
  },
  'TypeDefinitionExtendibleEnumeration': () => {
    return () => 16;
  },
  'TypeDefinitionStrongReference': () => {
    return () => 16;
  },
  'TypeDefinitionWeakReference': () => {
    return () => 16;
  },
  'TypeDefinitionString': () => {
    return (buf, pos) => {
      return buf.length - pos;
    };
  },
  'TypeDefinitionRename': def => {
    var elType = internalResolveByName('TypeDefinition', def.RenamedType);
    return sizingFns[elType.MetaType](elType);
  },
  'TypeDefinitionEnumeration': def => {
    if (def.Type === 'Boolean') return 1;
    var elType = internalResolveByName('TypeDefinition', def.ElementType);
    return sizingFns[elType.MetaType](elType);
  }
};

var lengthFns = {
  'TypeDefinitionInteger': def => {
    return () => def.Size;
  },
  'TypeDefinitionRecord': def => { // Cache to be fast
    switch (def.Symbol) {
    case 'AUID': return () => 16;
    case 'LocalTagEntry': return () => 18;
    case 'TimeStamp': return () => 8;
    case 'PackageIDType': return () => 32;
    case 'VersionType': return () => 2;
    case 'Rational': return () => 8;
    case 'IndexEntry': return () => 11;
    case 'DeltaEntry': return () => 6;
    case 'RandomIndexItem': return () => 12;
    default: return () => undefined;
    }
  },
  'TypeDefinitionSet': def => {
    return value => {
      if (!value) return undefined;
      var elType = internalResolveByName('TypeDefinition', def.ElementType);
      var elementFn = lengthFns[elType.MetaType](elType);
      var each = value.length > 0 ? elementFn(value[0]) : elementFn();
      return 8 + value.length * (typeof each === 'number' ? each : 0);
    };
  },
  'TypeDefinitionVariableArray': def => {
    if (def.Symbol === 'RandomIndexItemArray') {
      return value => {
        if (!value) return undefined;
        return value.length * 12;
      };
    } else {
      return value => {
        if (!value) return undefined;
        var elType = internalResolveByName('TypeDefinition', def.ElementType);
        var elementFn = lengthFns[elType.MetaType](elType);
        var each = value.length > 0 ? elementFn(value[0]) : elementFn();
        return 8 + value.length * (typeof each === 'number' ? each : 0);
      };
    }
  },
  'TypeDefinitionFixedArray': def => {
    return () => def.ElementCount; // TODO improve for non UInt8 types
  },
  'TypeDefinitionExtendibleEnumeration': () => {
    return () => 16;
  },
  'TypeDefinitionStrongReference': () => {
    return () => 16;
  },
  'TypeDefinitionWeakReference': () => {
    return () => 16;
  },
  'TypeDefinitionString': def => {
    switch (def.ElementType) {
    case 'UTF8Character':
      return (value) => Buffer.from(value, 'utf8').length;
    default:
    case 'Character':
      return (value) => Buffer.from(value, 'utf16le').length;
    }
  },
  'TypeDefinitionRename': def => {
    var elType = internalResolveByName('TypeDefinition', def.RenamedType);
    return lengthFns[elType.MetaType](elType);
  },
  'TypeDefinitionEnumeration': def => {
    if (def.Type === 'Boolean') return 1;
    var elType = internalResolveByName('TypeDefinition', def.ElementType);
    return lengthFns[elType.MetaType](elType);
  }
};

var resolveByID = function (id) {
  switch (id.substring(9,11)) {
  case '05':
  case '06':
  case '53':
    id = id.substring(0, 11) + '7f' + id.substring(13);
    break;
  default:
    break;
  }
  if (id.startsWith('060e2b34-0102-0101-0d01-0301')) {
    return readyDicts.then(makeEssenceElement.bind(null, id));
  }
  return readyDicts.then(() => {
    return metaDictByID[id];
  });
};

var resolveByName = function (type, name) {
  return readyDicts.then(() => {
    var def = metaDictByName[type][name];
    if (def) {
      return def;
    } else if (name && name.endsWith('Type')) {
      return metaDictByName[type][name.slice(0, -4)];
    }
    return undefined;
  });
};

// For use when already inside a promise
var internalResolveByName = function (type, name) {
  if (metaDictByName[type][name]) {
    return metaDictByName[type][name];
  } else if (name.endsWith('Type')) {
    return metaDictByName[type][name.slice(0, -4)];
  }
  return undefined;
};

// For use when already inside a promise
var internalResolveByID = function (id) {
  if (metaDictByID[id]) {
    return metaDictByID[id];
  } else {
    return metaDictByID[ulToUUID(id)];
  }
};

var readType = function (typeName) {
  return resolveByName('TypeDefinition', typeName).then(type => {
    if (!readingFns[type.MetaType])
      console.error('Failed to resolve type', type.MetaType, typeName);
    return readingFns[type.MetaType](type);
  });
};

var writeType = function (typeName) {
  return resolveByName('TypeDefinition', typeName).then(type => {
    if (!writingFns[type.MetaType])
      console.error('Failed to resolve type', type.MetaType, typeName);
    return writingFns[type.MetaType](type);
  });
};

var sizeType = function (typeName) {
  return resolveByName('TypeDefinition', typeName).then(type => {
    if (!sizingFns[type.MetaType])
      console.error('Failed to resolve type', type.MetaType);
    return sizingFns[type.MetaType](type);
  });
};

var lengthType = function (typeName) {
  return resolveByName('TypeDefinition', typeName).then(type => {
    if (!lengthFns[type.MetaType])
      console.error('Failed to resolve type', type.MetaType);
    return lengthFns[type.MetaType](type);
  });
};

var getPackOrder = function (name) {
  return resolveByName('ClassDefinition', name).then(def => {
    if (def.PackOrder) return def.PackOrder;
    if (def.ParentClass) return getPackOrder(def.ParentClass);
    return undefined;
  });
};

function writeUIntBE(v, buf, pos, size) {
  if (size === 8) {
    buf.writeUInt16BE(0, pos);
    buf.writeUIntBE(v, pos + 2, 6);
    return 8;
  } else {
    return buf.writeUIntBE(v, pos, size);
  }
}

function writeIntBE(v, buf, pos, size) {
  if (size === 8) {
    buf.writeUInt16BE(v < 0 ? 0xffff : 0, pos);
    buf.writeIntBE(v, pos + 2, 6);
    return 8;
  } else {
    return buf.writeIntBE(v, pos, size);
  }
}

function readUIntBE(buf, pos, size) {
  if (size === 8) {
    if (buf.readUInt16BE(pos) > 0)
      throw new Error('Reading a value larger than Javascript UInt 48-bit maximum.');
    return buf.readUIntBE(pos + 2, 6);
  } else {
    return buf.readUIntBE(pos, size);
  }
}

function readIntBE(buf, pos, size) {
  if (size === 8) {
    if (buf.readUInt16BE(pos) !== 0 && buf.readUInt16BE(pos) !== 0xffff)
      throw new Error('Reading a value larger or smaller than Javascript Int 48-bit maximum.');
    return buf.readIntBE(pos + 2, 6);
  } else {
    return buf.readIntBE(pos, size);
  }
}

var resetPrimer = function (initPack) {
  var baseDefs = {
    // Interchange object - masked by other logic
    0x3c0a: '060e2b34-0101-0101-0101-150200000000', // InstanceID
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
  var base = { count : 0xffff };
  Object.keys(baseDefs).forEach(k => {
    addPrimerTag(base, +k, baseDefs[k]);
  });
  if (initPack && initPack.ObjectClass === 'PrimerPack') {
    initPack.LocalTagEntries.forEach(ppi => {
      addPrimerTag(base, ppi.LocalTag, ppi.UID);
    });
  }
  return base;
};

var addPrimerTag = function (primer, localTag, uid) {
  primer[localTag] = uid;
  primer[uid] = localTag;
};

var getPrimerUID = function (primer, localTag) {
  var id = primer[localTag];
  if (id) return id;
  if (!shadowPrimer) {
    shadowPrimer = { };
    Object.keys(metaDictByID).forEach(k => {
      var def = metaDictByID[k];
      if (def.MetaType === 'PropertyDefinition' && def.LocalIdentification > 0)
        shadowPrimer[def.LocalIdentification] = ulToUUID(def.Identification);
    });
  }
  return shadowPrimer[localTag];
};

var makePrimerPack = function (items) {
  var pack = { ObjectClass : 'PrimerPack', LocalTagEntries : [] };
  Object.keys(items).filter(k => !isNaN(+k)).forEach(k => {
    pack.LocalTagEntries.push({ LocalTag : k, UID : items[k] });
  });
  return pack;
};

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
  getAllIDs: () => readDicts.then(() => Object.keys(metaDictByID)),
  readType: readType,
  sizeType: sizeType,
  writeType: writeType,
  lengthType: lengthType,
  getPackOrder: getPackOrder,
  resetPrimer: resetPrimer,
  addPrimerTag: addPrimerTag,
  getPrimerUID: getPrimerUID,
  makePrimerPack: makePrimerPack,
  ulToUUID: ulToUUID,
  writeUUID: writeUUID
};
