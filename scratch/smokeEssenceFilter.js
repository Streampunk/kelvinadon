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
var stripTheFiller = require('../pipelines/stripTheFiller.js');
var kelviniser = require('../pipelines/kelviniser.js');
var metatiser = require('../pipelines/metatiser.js');
var detailing = require('../pipelines/detailing.js');
var puppeteer = require('../pipelines/puppeteer.js');
var emmyiser = require('../pipelines/emmyiser.js');
var trackCacher = require('../pipelines/trackCacher.js');
var essenceFilter = require('../pipelines/essenceFilter.js');
var indexFilter = require('../pipelines/indexFilter.js');
var partitionFilter = require('../pipelines/partitionFilter.js');
var metadataFilter = require('../pipelines/metadataFilter.js');

var base = H(fs.createReadStream(process.argv[2]))
.through(kelviniser())
.through(metatiser())
.through(stripTheFiller)
.through(detailing())
.through(puppeteer())
.through(trackCacher());

base.fork()
 .through(partitionFilter('data1'))
 .doto(H.log)
 .errors(function (e) { console.error })
 .done(function () { console.log('Filterator filterated fork 1.'); });

base.fork()
  .through(metadataFilter())
  .doto(H.log)
  .errors(function (e) { console.error })
  .done(function () { console.log('Filterator filterated fork 2.') });
base.resume();
