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

// Asyncrhonous nature of meta definition resolution means this method would
// not work well with flatMap.

var metatiser = function () {
  var metaChomper = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else {
      meta.resolveByID(x.key)
        .then(function (y) {
          if (!y) {
            push(`Omitting unknown key ${x.key} in MXF KLV stream.`);
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
  }; // metaChomper
  return H.pipeline(H.consume(metaChomper));
};

module.exports = metatiser;
