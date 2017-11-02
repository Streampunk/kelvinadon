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

var H = require('highland');
var meta = require('../util/meta.js');
var KLVPacket = require('../model/KLVPacket.js');
var uuid = require('uuid');

function packetator () {
  var primer = meta.resetPrimer();
  var packetMaker = (err, x, push, next) => {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      var detail = null;
      var lengthLength = 4;
      var filePos = 0;
      if (KLVPacket.isKLVPacket(x)) {
        if (x.detail) {
          detail = x.detail;
          lengthLength = x.lengthLength;
          filePos = x.filePos;
        } else {
          push('Received KLV packet without detail.');
          return next();
        }
      } else {
        if (x.ObjectClass) {
          detail = x;
        } else if (x.detail && x.detail.ObjectClass) {
          detail = x.detail;
        } else {
          push('Received object with insufficient detail to make a KLV packet.');
          return next();
        }
      }
      if (detail.ObjectClass === 'PrimerPack') {
        primer = meta.resetPrimer(detail);
        return next();
      }
      meta.resolveByName('ClassDefinition', detail.ObjectClass)
        .then(cls => {
          var key = meta.ulToUUID(cls.Identification);
          switch (uuid.parse(key)[5]) {
          case 0x05: // Fixed length pack
            return meta.getPackOrder(cls.Symbol).then(po => {
              var resolve = po.map(item => {
                return meta.resolveByName('PropertyDefinition', item).then(pd => {
                  return Promise.all([
                    pd.Symbol,
                    meta.writeType(pd.Type),
                    meta.lengthType(pd.Type) ]);
                });
              });
              return Promise.all(resolve).then(work => {
                var length = work.reduce((sum, prop) => {
                  var size = prop[2](detail[prop[0]]);
                  return sum + size;
                }, 0);
                var buf = Buffer.allocUnsafe(length);
                var pos = 0;
                for (let prop of work) {
                  pos += prop[1](detail[prop[0]], buf, pos);
                }
                var klv = new KLVPacket(key, length, [buf], lengthLength, filePos);
                klv.meta = cls;
                klv.detail = detail;
                push(null, klv);
                next();
              });
            });
          case 0x06:
          case 0x53: // local sets with 2-byte keys and values
            var propProm = Object.keys(detail).filter(k => k != 'ObjectClass').map(k => {
              return meta.resolveByName('PropertyDefinition', k);
            });
            return Promise.all(propProm).then(props => {
              var propAndTypes = props.map(prop => {
                return Promise.all([
                  prop,
                  meta.lengthType(prop.Type),
                  meta.writeType(prop.Type)
                ]);
              });
              return Promise.all(propAndTypes);
            }).then(work => {
              work = work.map(job => {
                var j = {
                  localID : job[0].LocalIdentification,
                  symbol : job[0].Symbol,
                  propID : meta.ulToUUID(job[0].Identification),
                  lengthFn : job[1],
                  writeFn : job[2]
                };
                j.value = detail[j.symbol];
                j.length = j.lengthFn(j.value);
                return j;
              });
              var totalLen = work.reduce((x, y) => x + y.length + 4, 0);
              var buf = Buffer.allocUnsafe(totalLen);
              var pos = 0;
              for ( let job of work ) {
                if (job.localID > 0 && primer[job.localID]) {
                  pos = buf.writeUInt16BE(job.localID, pos);
                } else if (primer[job.propID]) {
                  pos = buf.writeUInt16BE(+primer[job.propID], pos);
                } else {
                  push(`For local set ${detail.ObjectClass}, property ${job.symbol}, unable to resolve tag in primer pack.`);
                  pos = buf.writeUInt16BE(0, pos);
                }
                pos = buf.writeUInt16BE(job.length, pos);
                pos += job.writeFn(job.value, buf, pos);
              }
              key = key.slice(0, 11) + '53' + key.slice(13); // TODO force key to 2-byte local sets
              var klv = new KLVPacket(key, totalLen, [buf], lengthLength, filePos);
              klv.props = [];
              for ( let job of work )
                klv.props.push({ tag: job.localID, plen: job.length, name: job.symbol});
              klv.meta = cls;
              klv.detail = detail;
              push(null, klv);
              next();
            });
          case 0x13: // Unxupported local set with BER property lengths
            push(`Encoding local sets with BER property lengths is not supported. Object class ${detail.ObjectClass}.`);
            next();
            break;
          case 0x02: // Most likely an essence element
            var trackStart = key.length - 8;
            var itemType = (t => {
              switch (t) {
              case 'SDTI-CP Picture (SMPTE 326M)': return '05';
              case 'SDTI-CP Sound (SMPTE 326M)' : return '06';
              case 'SDTI-CP Data (SMPTE 326M)' : return '07';
              case 'GC Picture' : return '15';
              case 'GC Sound' : return '16';
              case 'GC Data' : return '17';
              case 'GC Compound' : return '18';
              default: return '00';
              }})(detail.ItemType);
            var elementType = detail.ElementType.toString(16);
            var elementCount = detail.ElementCount.toString(16);
            var elementNumber = detail.ElementNumber.toString(16);
            detail.Track = itemType +
              ((elementCount.length === 1) ? '0' + elementCount : elementCount) +
              ((elementType.length === 1) ? '0' + elementType : elementType) +
              ((elementNumber.length === 1) ? '0' + elementNumber : elementNumber);
            key = key.slice(0, trackStart) + detail.Track;
            var length = detail.Data.length;
            var klv = new KLVPacket(key, length, [ detail.Data ],
              length < 16777216 ? 4 : 8, filePos);
            klv.meta = cls;
            klv.detail = detail;
            push(null, klv);
            next();
            break;
          default:
            break;
          }
        })
        .catch(e => {
          push(`Error resolving metadata for ${detail.ObjectClass}: ${e}.`);
          next();
        });
    }
  };

  return H.pipeline(H.consume(packetMaker));
}

module.exports = packetator;
