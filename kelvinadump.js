#!/usr/bin/env node
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
var fs = require('fs');
var uuid = require('uuid');
var util = require('util');
const EventEmitter = require('events');
var stripTheFiller = require('./pipelines/stripTheFiller.js');
var kelviniser = require('./pipelines/kelviniser.js');
var metatiser = require('./pipelines/metatiser.js');
var detailing = require('./pipelines/detailing.js');
var puppeteer = require('./pipelines/puppeteer.js');

// TODO add more command line paramters

fs.accessSync(process.argv[2], fs.R_OK);

H(fs.createReadStream(process.argv[2]))
  .through(kelviniser())
  .through(metatiser())
  // .through(stripTheFiller)
  .through(detailing())
  .errors(function (e) { console.error(e); })
  .each(function (klv) {
    console.log(util.inspect(klv, { depth : null}));
  })
  .done(function () { console.log(`Completed dumping '${process.argv[2]}'.`)});
