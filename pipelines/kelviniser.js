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
var KLVPacket = require('../model/KLVPacket.js');
var getKeyAndLength = require('../util/klvUtil.js').getKeyAndLength;

function kelviniser (errors) {
  var bufferCount = 0;
  var hangover = null;
  var remaining = 0;
  var filePos = 0;
  var nextKLVToSend = null;
  var kelvinChomper = function (err, x, push, next) {
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
          if (errors) console.log('Detected KLV wrap around.');
          hangover = x.slice(pos);
          pos = x.length;
        }
      }
    //   if (hangover && remaining === 0) console.log('BAD HANGOVER', hangover.length);
      filePos += x.length - ((hangover && remaining === 0) ? hangover.length : 0);
      next();
    }
  }; // kelvinChomper
  return H.pipeline(H.consume(kelvinChomper));
};

module.exports = kelviniser;
