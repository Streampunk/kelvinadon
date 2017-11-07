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
var uuid = require('uuid');
var meta = require('../util/meta.js');
var KLVPacket = require('../model/KLVPacket.js');

function pieceMaker() {
  var primerChain = Promise.resolve(meta.resetPrimer());
  var items = [];

  function splitItem (v) {
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      return v.map(i => splitItem(i));
    }
    var u = { InstanceID : uuid.v4() };
    items.push(u);
    Object.keys(v).filter(k => k !== 'InstanceID').forEach(k => {
      u[k] = splitItem(v[k]);
      primerChain = primerChain.then(primer => {
        return meta.resolveByName('PropertyDefinition', k)
          .then(prop => {
            if (prop.LocalIdentification > 0) {
              meta.addPrimerTag(primer, prop.LocalIdentification,
                meta.ulToUUID(prop.Identification));
            } else {
              meta.addPrimerTag(primer, primer.count--,
                meta.ulToUUID(prop.Identification));
            }
            return primer;
          }, () => primer);
      });
    });
    return u.InstanceID;
  }

  var splitter = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x == H.nil) {
      push(null, x);
    } else {
      var detail = (KLVPacket.isKLVPacket(x)) ? x.detail : x;
      if (detail.ObjectClass && detail.ObjectClass === 'Preface') {
        splitItem(detail);
        primerChain.then(primer => {
          push(null, meta.makePrimerPack(primer));
          // push(null, preface);
          items.forEach(i => push(null, i));
          next();
        }).catch(e => { push(e); next(); });
      } else if (!x.meta || x.meta.ObjectClass !== 'PrimerPack') {
        push(null, x); // Swallow primer packs
        next();
      } else {
        next();
      }
    }
  };
  return H.pipeline(H.consume(splitter));
}

module.exports = pieceMaker;
