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

var tape = require('tape');
var Promise = require('promise');
var fs = require('fs');

var readFile = Promise.denodeify(fs.readFile);

tape('Parsing baseline defs by ID', function (t) {
  var readTime = process.hrtime();
  readFile('lib/baselineDefsByID.json', 'utf8')
    .then(function (json) {
      t.ok(json.length > 0, 'reads a non empty file.');
      return json;
    })
    .then(JSON.parse)
    .then(function (defs) {
      var totalTime = process.hrtime(readTime);
      t.ok(totalTime[0] === 0 && totalTime[1] <= 999999999,
        `is sub second at ${totalTime[1]/1000000}ms.`);
      t.equal(typeof defs, 'object', 'creates an object.');
      t.equal(Object.keys(defs).length, 530, 'has expected no of definitions.');
    })
    .catch(t.fail)
    .done(t.end);
});

tape('Parsing baseline defs by name', function (t) {
  var readTime = process.hrtime();
  readFile('lib/baselineDefsByName.json', 'utf8')
    .then(function (json) {
      t.ok(json.length > 0, 'reads a non empty file.');
      return json;
    })
    .then(JSON.parse)
    .then(function (defs) {
      var totalTime = process.hrtime(readTime);
      t.ok(totalTime[0] === 0 && totalTime[1] <= 999999999,
        `is sub second at ${totalTime[1]/1000000}ms.`);
      t.equal(typeof defs, 'object', 'creates an object.');
      t.equal(Object.keys(defs).length, 4, 'has expected no of properties.');
    })
    .catch(t.fail)
    .done(t.end);
});
