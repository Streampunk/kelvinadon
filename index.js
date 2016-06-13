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

H(fs.createReadStream('/Volumes/Ormiscraid/media/streampunk/gv/PAL_1080i_MPEG_XDCAM-HD422_colorbar.mxf'))
  .through(kelviniser())
  .through(metatiser(true))
  .through(stripTheFiller)
  .through(detailing())
  // .ratelimit(1, 100)
  .each(function (x) { console.log(x);  })
  .errors(console.error)
  .done(console.log.bind(null, "made it"));
