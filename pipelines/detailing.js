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
var meta = require('../util/meta.js');
var Promise = require('promise');
var uuid = require('uuid');

function detailing() {
  var primer = null;
  var detailChomper = function (err, x, push, next) {
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
              primer = meta.resetPrimer();
              x.detail.LocalTagEntryBatch.forEach(function (ppi) {
                meta.addPrimerTag(primer, ppi.LocalTag, ppi.UID);
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
          props.push([pos, meta.getPrimerUID(primer, tag), plen, tag]);
          pos += 4 + plen;
        }
        var resolve = props.map(function (prop) {
          return meta.resolveByID(prop[1]).then(function (pd) {
            return Promise.all([
              Promise.resolve(pd.Symbol),
              Promise.resolve(prop[0] + 4),
              meta.readType(pd.Type),
              Promise.resolve(prop[2])
            ]).catch(function (e) { push(e); return next(); });
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
        }).catch(function (e) { push(e); next(); });
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
          ElementCount: parseInt(x.key.slice(trackStart + 2, trackStart + 4), 16),
          ElementNumber: parseInt(x.key.slice(trackStart + 6), 16)
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
  }; // detailChomper

  return H.pipeline(H.consume(detailChomper));
};

module.exports = detailing;
