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

var H = require('highland');
var KLVPacket = require('./model/KLVPacket.js');
var fs = require('fs');
var meta = require('./util/meta.js');
var uuid = require('uuid');

function getKeyAndLength(buffer, position) {
  if (buffer.length - position <= 17) return { success : false, position: position };
  var berHead = buffer.readUInt8(position + 16);
  if (berHead < 128) return {
    key : buffer.slice(position, position + 16),
    length : berHead,
    success : true,
    position : position + 17
  };
  var tailLength = berHead & 0x7f;
  if (buffer.length - position < 17 + tailLength)
    return { success : false, position : position };
  return {
    key : buffer.slice(position, position + 16),
    length : buffer.readUIntBE(position + 17, tailLength),
    lengthLength : tailLength + 1,
    success : true,
    position : position + 17 + tailLength
  };
};

var hangover = null;
var remaining = 0;
var nextKLVToSend = null;
var bufferCount = 0;
var filePos = 0;

H(fs.createReadStream('/Volumes/Ormiscraid/media/streampunk/gv/PAL_1080i_MPEG_XDCAM-HD422_colorbar.mxf'))
  .consume(function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      var pos = 0;
      bufferCount++;
      if (hangover) { // Break in a key
        if (Buffer.isBuffer(hangover) && remaining === 0) {
          x = Buffer.concat([hangover, x], hangover.length + x.length);
        } else if (remaining > x.length) { // Break in valye ... not enough in buffer.
            hangover.push(x);
            remaining -= x.length;
            pos = x.length;
        } else { // Break in data - enough in buffer
          hangover.push(x.slice(pos, pos + remaining));
          push(null, new KLVPacket(nextKLVToSend.key, nextKLVToSend.length, hangover,
            nextKLVToSend.lengthLength, filePos + pos));
          // console.log('Pushed a packet', hangover.map(x => { return x.length; }));
          pos += remaining;
          remaining = 0;
          hangover = null;
          nextKLVToSend = null;
        }
      }
      while (pos < x.length) {
        var nextKLV = getKeyAndLength(x, pos);
        if (nextKLV.success) {
          // console.log('+++ more pos', pos, pos.toString(16));
          var streamPos = filePos + pos;
          pos = nextKLV.position;
          if (x.length - pos >= nextKLV.length) {
            var p = new KLVPacket(nextKLV.key, nextKLV.length,
              x.slice(pos, pos + nextKLV.length), nextKLV.lengthLength,
              streamPos);
            push(null, p);
            pos += nextKLV.length;
            hangover = null;
            remaining = 0;
          } else { // Not enough bytes to make a KLVPacket
            hangover = [ x.slice(pos) ];
            remaining = nextKLV.length - (x.length - pos);
            pos = x.length;
            nextKLVToSend = nextKLV;
            // console.log(nextKLVToSend);
            // console.log('Not enough bytes to make a KLVPacket', hangover[0].length, pos, remaining);
          }
        } else { // Not enough bytes to read next key
          console.log('Detected KLV wrap around.');
          hangover = x.slice(pos);
          pos = x.length;
        }
      }
    //   if (hangover && remaining === 0) console.log('BAD HANGOVER', hangover.length);
      filePos += x.length - ((hangover && remaining === 0) ? hangover.length : 0);
      next();
    }

  })
  .consume(function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      meta.resolveByID(x.key)
        .then(function (y) {
          if (!y) {
            console.error(`Omitting unknown key ${x.key} in MXF KLV stream.`);
            push(null, x);
          } else {
            x.meta = y;
            push(null, x);
          }
          next();
        })
        .catch(function (e) {
          push(e);
          next();
        });
    }
  })
  .filter(function (x) { return x.meta && !x.meta.Symbol.startsWith("KLVFill"); })
  .consume(function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      if (x.value.length > 1) {
        x.value = [ Buffer.concat(x.value, x.length) ];
      }
      switch (uuid.parse(x.key)[5]) {
      case 0x05:  // Fixed length pack
        x.detail = { ObjectClass: x.meta.Symbol };
        meta.getPackOrder(x.meta.Symbol).then(function (po) {
          var resolve = po.map(function (item) {
            return meta.resolveByName("PropertyDefinition", item).then(function (pd) {
               return Promise.all([
                 Promise.resolve(pd.Symbol),
                 meta.readType(pd.Type),
                 meta.sizeType(pd.Type) ]);
            });
          });
          Promise.all(resolve).then(function (work) {
            var pos = 0;
            work.forEach(function (job) {
              // console.log('Setting', job[0], job[2].call(x.value[0], pos));
              x.detail[job[0]] = job[1].call(x.value[0], pos);
              pos += job[2].call(x.value[0], pos);
            });
            if (x.meta.Symbol === 'PrimerPack') {
              meta.resetPrimer();
              x.detail.LocalTagEntryBatch.forEach(function (ppi) {
                meta.addPrimerTag(ppi.LocalTag, ppi.UID);
              });
            }
          }).then(function () {
            push(null, x);
            next();
          }).catch(function (e) { console.error(e.message, e.stack)});
        });
        break;
      case 0x53: // Local sets with 2-byte keys and values
        x.detail = { ObjectClass: x.meta.Symbol };
        var pos = 0;
        var buf = x.value[0];
        var props = [];
        while (pos < x.length) {
          var tag = buf.readUInt16BE(pos);
          var plen = buf.readUInt16BE(pos + 2);
          props.push([pos, meta.getPrimerUID(tag), plen, tag]);
          pos += 4 + plen;
        }
        var resolve = props.map(function (prop) {
          return meta.resolveByID(prop[1]).then(function (pd) {
            return Promise.all([
              Promise.resolve(pd.Symbol),
              Promise.resolve(prop[0] + 4),
              meta.readType(pd.Type),
              Promise.resolve(prop[2])
            ]).catch(console.error);
          });
        });
        Promise.all(resolve).then(function (work) {
          work.forEach(function (job) {
            // console.log('Setting', job[0], job[2].call(x.value[0], job[1], job[3]));
            x.detail[job[0]] = job[2].call(x.value[0], job[1], job[3]);
          });
          x.props = [];
          for ( var i = 0 ; i < work.length ; i++ ) {
            x.props.push({ tag: props[i][3], plen: props[i][2], name: work[i][0] });
          };
        }).then(function() {
          push(null, x);
          next();
        }).catch(console.error);
        break;
      case 0x13:
        push("Decoding local stes with BER property lengths is not supported.");
        next();
        break;
      case 0x02:
        // Probably an essence Element
        var trackStart = x.key.length - 8;
        x.detail = {
          ObjectClass: "EssenceElement",
          Track: x.key.slice(trackStart),
          ItemType: (function (itemType) {
            switch (itemType) {
              case '05' : return 'SDTI-CP Picture (SMPTE 326M)';
              case '06' : return 'SDTI-CP Sound (SMPTE 326M)';
              case '07' : return 'SDTI-CP Data (SMPTE 326M)';
              case '15' : return 'GC Picture';
              case '16' : return 'GC Sound';
              case '17' : return 'GC Data';
              case '18' : return 'GC Compound';
              default: return 'Unknown';
            }
          })(x.key.slice(trackStart, trackStart + 2)),
          ElementType: '0x' + x.key.slice(trackStart + 4, trackStart + 6),
          ElementCount: +x.key.slice(trackStart + 2, trackStart + 4),
          ElementNumber: +x.key.slice(trackStart + 6)
        };
        push(null, x);
        next();
        break;
      default:
        push(null, x);
        next();
        break;
      }
    }
  })
  .each(function (x) { console.log(x);  })
  .errors(console.error)
  .done(console.log.bind(null, "made it"));
