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
var fs = require('fs');
var uuid = require('uuid');
var stripTheFiller = require('./pipelines/stripTheFiller.js');
var kelviniser = require('./pipelines/kelviniser.js');
var metatiser = require('./pipelines/metatiser.js');
var detailing = require('./pipelines/detailing.js');
var puppeteer = require('./pipelines/puppeteer.js');
var util = require('util');
const EventEmitter = require('events');

function MXFEmitter() {
  EventEmitter.call(this);
};
util.inherits(MXFEmitter, EventEmitter);
const mxfEmmy = new MXFEmitter();

var cachedTracks = { };

function searchForTrack(item) {
  Object(item).keys.forEach(function (name) {
    var value = item[name];
    if (typeof value === 'object') {
      if (value.EssenceTrackNumber) {
        cachedTracks[value.EssenceTrackNumber] = value;
      } else {
        searchForTrack(value);
      }
    }
  };
}

H(fs.createReadStream(process.argv[2]))
  .through(kelviniser())
  .through(metatiser())
  .through(stripTheFiller)
  .through(detailing())
  // .ratelimit(1, 100)
  .through(puppeteer())
  .doto(function (x) {
    if (x.ObjectClass && x.ObjectClass === 'Preface') {
      searchForTrack(item);
      console.log(cachedTracks);
      return mxfEmmy.emit('metadata', x);
    };
    if (x.meta.Symbol.endsWith('PartitionPack')) {
      return mxfEmmy.emiti('partition', x);
    };
    if (x.meta.Symbol === 'IndexTableSegment') {
      return mxfEmmy.emit('index', x);
    };
  })
  .errors(function (e) { mxfEmmy.emit('error', e); })
  .done(console.log.bind(null, "made it"));

mxfEmmy.on('metadata', function (x) {
  console.log(util.inspect(x, { depth: null }))});
mxfEmmy.on('error', function (e) {
  if (!e.startsWith('Omitting')) console.error(e);
});

module.exports = {
  mxfEmmitter: mxfEmmitter,
  kelviniser: kelviniser,
  metatiser: metatiser,
  stripTheFiller : stripTheFiller,
  detailing: detailing,
  puppeteer: puppetter
};
