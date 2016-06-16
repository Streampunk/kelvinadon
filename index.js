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
var util = require('util');
const EventEmitter = require('events');
var stripTheFiller = require('./pipelines/stripTheFiller.js');
var kelviniser = require('./pipelines/kelviniser.js');
var metatiser = require('./pipelines/metatiser.js');
var detailing = require('./pipelines/detailing.js');
var puppeteer = require('./pipelines/puppeteer.js');
var emmyiser = require('./pipelines/emmyiser.js');
var trackCacher = require('./pipelines/trackCacher.js');

function MXFEmitter (stream) {
  EventEmitter.call(this);
  this.getTrackList = function () { return []; }
  this.getTrackDetails = function () { return undefined; }
  var emmy = this;
  this.highland = H(stream)
  .through(kelviniser())
  .through(metatiser())
  .through(stripTheFiller)
  .through(detailing())
  .through(puppeteer())
  .through(trackCacher())
  .through(emmyiser(emmy))
  .errors(function (e) { emmy.emit('error', e); })
  .done(function () { emmy.emit('done'); });
};
util.inherits(MXFEmitter, EventEmitter);

var mxfEmmy = new MXFEmitter(fs.createReadStream(process.argv[2]));
mxfEmmy.on('metadata', function (x) {
  console.log(util.inspect(x, { depth: null }));
  console.log(mxfEmmy.getTrackList());
  console.log(mxfEmmy.getTrackDetails('picture0'));
});
mxfEmmy.on('error', function (e) {
  if (typeof e !== 'string' || !e.startsWith('Omitting')) console.error(e);
});
var picCount = 0;
var data = [];
var dataLength = 0;
// mxfEmmy.on('picture0', function (x) { console.log(x.length ); });
mxfEmmy.on('done', function (x) { console.log('Phew!'); });

module.exports = {
  MXFEmitter: MXFEmitter,
  kelviniser: kelviniser,
  metatiser: metatiser,
  stripTheFiller : stripTheFiller,
  detailing: detailing,
  puppeteer: puppeteer,
  emmyiser: emmyiser
};
