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

const H = require('highland');
const fs = require('fs');
const util = require('util');
const kelviniser = require('./pipelines/kelviniser.js');
const stripTheFiller = require('./pipelines/stripTheFiller.js');
const metatiser = require('./pipelines/metatiser.js');
const detailing = require('./pipelines/detailing.js');
const puppeteer = require('./pipelines/puppeteer.js');

var argv = require('yargs')
  .help('help')
  .default('metaclass', true)
  .default('filler', false)
  .default('detailing', true)
  .default('nest', true)
  .default('flatten', false)
  .boolean(['filler', 'metaclass', 'detailing', 'nest', 'flatten'])
  .string(['version'])
  .usage('Dump an MXF file as a stream of JSON objects.\n' +
    'Usage: $0 [options] <file.mxf>')
  .describe('filler', 'include filler in the output')
  .describe('metaclass', 'resolves keys to meta classes')
  .describe('detailing', 'decode bytes to JS objects')
  .describe('nest', 'nest children within preface')
  .describe('flatten', 'show only detail for each KLV packet')
  .example('$0 --filler my_big_camera_file.mxf')
  .check((argv) => {
    fs.accessSync(argv._[0], fs.R_OK);
    return true;
  })
  .argv;

if (argv.filler) argv.metaclass = true;
if (argv.flatten) argv.detailing = true;
if (argv.nest) argv.detailing = true;
if (argv.detailing) argv.metaclass = true;

var klvs = H(fs.createReadStream(argv._[0])).through(kelviniser());
if (argv.metaclass) klvs = klvs.through(metatiser());
if (!argv.filler) klvs = klvs.through(stripTheFiller);
if (argv.detailing) klvs = klvs.through(detailing());
if (argv.nest) klvs = klvs.through(puppeteer());

klvs
  .flatMap(x => {
    if (argv.flatten) {
      if (x.detail) {
        return H([x.detail]);
      }
      if (x.ObjectClass === 'Preface') { // following on from puppeteer
        return H([x]);
      } else {
        return H([]);
      }
    }
    return H([x]);
  })
  .errors(e => { console.error(e); })
  .each(klv => {
    console.log(util.inspect(klv, { depth : null}));
  })
  .done(() => { console.log(`Completed dumping '${argv._[0]}'.`); });
