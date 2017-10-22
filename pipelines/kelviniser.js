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
var KLVPacket = require('../model/KLVPacket.js');
var getKeyAndLength = require('../util/klvUtil.js').getKeyAndLength;

function kelviniser (errors) {
  var hangover = [];
  var remaining = 0;
  var filePos = 0;
  var bufferCount = 0;
  var nextKLVToSend = null;
  var kelvinMapper = function (x) {
    var pos = 0;
    bufferCount++;
    var klvs = [];
    if (hangover.length > 0) {
      if (hangover.length === 1 && remaining === 0) {
        x = Buffer.concat([hangover[0], x], hangover[0].length + x.length);
      } else if (remaining > x.length) {
        hangover.push(x);
        remaining -= x.length;
        pos = x.length;
      } else {
        hangover.push(x.slice(pos, pos + remaining));
        hangover = hangover.filter(x => x.length > 0);
        klvs.push(new KLVPacket(nextKLVToSend.key, nextKLVToSend.length, hangover,
          nextKLVToSend.lengthLength, nextKLVToSend.filePos));
        pos += remaining;
        remaining = 0;
        hangover = [];
        nextKLVToSend = null;
      }
    }
    while (pos < x.length) {
      var nextKLV = getKeyAndLength(x, pos);
      if (nextKLV.success) {
        var streamPos  = filePos + pos;
        pos = nextKLV.position;
        if (x.length - pos >= nextKLV.length) {
          klvs.push(new KLVPacket(nextKLV.key, nextKLV.length,
            x.slice(pos, pos + nextKLV.length), nextKLV.lengthLength,
            streamPos));
          pos += nextKLV.length;
          remaining = 0;
          hangover = [];
        } else {
          hangover.push(x.slice(pos));
          remaining = nextKLV.length - (x.length - pos);
          pos = x.length;
          nextKLVToSend = nextKLV;
          nextKLVToSend.filePos = streamPos;
        }
      } else {
        if (errors) console.log('Detected KLV wrap around.');
        hangover = [ x.slice(pos) ];
        pos = x.length;
        remaining = 0;
      }
    }
    filePos += x.length - ((hangover.length === 1 && remaining === 0) ? hangover[0].length : 0);
    return H(klvs);
  }
  return H.pipeline(H.flatMap(kelvinMapper));
}

module.exports = kelviniser;
