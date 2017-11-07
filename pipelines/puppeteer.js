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

function puppeteer() {
  var cache = { };
  var preface = null;
  var headerByteCount = 0;
  var headerEnd = -1;
  function resolveAll(item) {
    // console.log('Resolving', item.ObjectClass);
    Object.keys(item)
      .filter(x => x !== 'InstanceID' && x !== 'PrimaryPackage')
      .forEach(name => {
        var value = item[name];
        if (typeof value === 'string' && value.match(
          /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)) {
          var sub = cache[value];
          if (sub) {
            resolveAll(sub);
            item[name] = sub;
          }
        } else if (Array.isArray(value)) {
          var subArray = [];
          value.forEach(subElement => {
            if (typeof subElement === 'string' && subElement.match(
              /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)) {
              var sub = cache[subElement];
              if (sub) {
                resolveAll(sub);
                subArray.push(sub);
              } else {
                subArray.push(subElement);
              }
            } else {
              subArray.push(subElement);
            }
          });
          item[name] = subArray;
        }
      });
  }

  var pullTheStrings = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      if (preface) push(null, preface); // Push partially constructed preface
      push(null, H.nil);
    } else {
      if (x.meta && x.meta.Symbol.indexOf('Partition') &&
          x.detail && x.detail.HeaderByteCount &&
          x.detail.HeaderByteCount > 0) {
        headerByteCount = x.detail.HeaderByteCount;
        headerEnd = -1;
        preface = null;
        cache = { };
        push(null, x);
        return next();
      }
      if (x.meta && x.meta.Symbol === 'PrimerPack') { // Beginning of header metaata
        headerEnd = x.filePos + headerByteCount;
        return next();// Don't send the primer pack on - used locally only
      }
      if (headerEnd < 0) { // Not collecting header classes
        push(null, x);
        return next();
      }
      if (x.meta && x.meta.Symbol === 'Preface') {
        preface = x.detail;
      }
      if (x.filePos >= headerEnd) { // We're done ... start resolving
        resolveAll(preface);
        push(null, preface);
        push(null, x);
        headerEnd = -1;
        headerByteCount = 0;
        preface = null;
        cache = {};
        return next();
      }
      if (x.detail && x.detail.InstanceID) cache[x.detail.InstanceID] = x.detail;
      next();
    }
  };
  return H.pipeline(H.consume(pullTheStrings));
}

module.exports = puppeteer;
