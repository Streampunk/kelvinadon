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
var util = require('util');
const EventEmitter = require('events');
var stripTheFiller = require('./pipelines/stripTheFiller.js');
var kelviniser = require('./pipelines/kelviniser.js');
var metatiser = require('./pipelines/metatiser.js');
var detailing = require('./pipelines/detailing.js');
var puppeteer = require('./pipelines/puppeteer.js');
var emmyiser = require('./pipelines/emmyiser.js');
var trackCacher = require('./pipelines/trackCacher.js');
var partitionFilter = require('./pipelines/partitionFilter.js');
var indexFilter = require('./pipelines/indexFilter.js');
var metadataFilter = require('./pipelines/metadataFilter.js');
var essenceFilter = require('./pipelines/essenceFilter.js');
var kelvinator = require('./pipelines/kelvinator.js');
var packetator = require('./pipelines/packetator.js');
var pieceMaker = require('./pipelines/pieceMaker.js');

function MXFEmitter (stream) {
  EventEmitter.call(this);
  this.getTrackList = function () { return []; };
  this.getTrackDetails = function () { return undefined; };
  var emmy = this;
  this.highland = H(stream)
    .through(kelviniser())
    .through(metatiser())
    .through(stripTheFiller)
    .through(detailing())
    .through(puppeteer())
    .through(trackCacher())
    .through(emmyiser(emmy))
    .errors(e => { emmy.emit('error', e); })
    .done(() => { emmy.emit('done'); });
}
util.inherits(MXFEmitter, EventEmitter);

module.exports = {
  MXFEmitter: MXFEmitter,
  kelviniser: kelviniser,
  metatiser: metatiser,
  stripTheFiller : stripTheFiller,
  detailing: detailing,
  puppeteer: puppeteer,
  trackCacher: trackCacher,
  emmyiser: emmyiser,
  partitionFilter: partitionFilter,
  indexFilter: indexFilter,
  metadataFilter: metadataFilter,
  essenceFilter: essenceFilter,
  kelvinator: kelvinator,
  packetator: packetator,
  pieceMaker: pieceMaker
};
