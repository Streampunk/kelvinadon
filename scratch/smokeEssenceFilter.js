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
var klv = require('../index.js');

var base = H(fs.createReadStream(process.argv[2]))
  .through(klv.kelviniser())
  .through(klv.metatiser())
  .through(klv.stripTheFiller())
  .through(klv.detailing())
  .through(klv.puppeteer())
  .through(klv.trackCacher());

base.fork()
  .through(klv.essenceFilter('picture0'))
  .doto(H.log)
  .errors(e => { console.error(e); })
  .done(() => { console.log('Finished reading picture data.'); });

base.fork()
  .through(klv.essenceFilter('sound0'))
  .doto(H.log)
  .errors(e => { console.error(e); })
  .done(() => { console.log('Finished reading sound data.'); });
base.resume();
