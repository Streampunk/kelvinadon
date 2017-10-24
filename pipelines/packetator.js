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

function packetator (primer) {
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
      meta.resolveByName('ClassDefinition', detail.ObjectClass)
        .then(cls => {
          var key = meta.ulToUUID(cls.Identification);
          switch (uuid.parse(key)[5]) {
          case 0x05: // Fixed length pack
            meta.getPackOrder(cls.Symbol).then(po => {
              var resolve = po.map(item => {
                return meta.resolveByName("PropertyDefinition", item).then(pd => {
                  return Promise.all([
                    pd.Symbol,
                    meta.writeType(pd.Type),
                    meta.lengthType(pd.Type) ]);
                });
              });
              Promise.all(resolve).then(work => {
                var length = work.reduce((sum, prop) => {
                  var size = prop[2](detail[prop[0]]);
                  return sum + size;
                }, 0);
                var buf = Buffer.allocUnsafe(length);
                var pos = 0;
                for (let prop of work) {
                  pos += prop[1](detail[prop[0]], buf, pos);
                };
                var klv = new KLVPacket(key, length, [buf], lengthLength, filePos);
                klv.meta = cls
                klv.detail = detail;
                push(null, klv);
                next();
              });
            });
            break;
          case 0x53: // local sets with 2-byte keys and values
            break;
          case 0x13: // Unxupported local set with BER property lengths
            push(`Encoding local sets with BER property lengths is not supported. Object class ${detail.ObjectClass}.`);
            next();
            break;
          case 0x02: // Most likely an essence element
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
  }

  return H.pipeline(H.consume(packetMaker));
}

module.exports = packetator;
