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

var klv = require('../index.js');
var fs = require('fs');
var util = require('util');

// Create a new MXF event emitter for a Node.js readable stream
var mxfEvents = new klv.MXFEmitter(fs.createReadStream(process.argv[2]));

// Listen for errors
mxfEvents.on('error', function (e) { console.error(e); });

// Receive any header metadata sets (optional)
// mxfEvents.on('metadata', function (preface) {
//   console.log('*** METADATA ***\n');
//   console.log(util.inspect(preface, { depth : null }));
// });

var picCount = 0;

// Listen for information on a pictire track
mxfEvents.once('picture0', function (data) {
  console.log(`*** PICTURE ${picCount++} ***\n`);
  console.log(util.inspect(data, { depth : null }));
  fs.writeFile('frame0.h264', data.value, console.error);
});

// var soundCount = 0;
//
// mxfEvents.on('sound0', function (data) {
//   console.log(`*** SOUND ${soundCount++} ***\n`);
//   console.log(util.inspect(data, { depth : null }));
// });

// EVent called at the end of the stream
mxfEvents.on('done', function () { console.log('Streaming complete.'); });
