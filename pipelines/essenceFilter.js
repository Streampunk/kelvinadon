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

function essenceFilter(trackName) {
  var cachedTracks = { };
  var numberToName = { };
  var nameToNumber = { };
  var filterator = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else if (x.ObjectClass && x.ObjectClass === 'TrackCache') {
      cachedTracks = x.cachedTracks;
      numberToName = x.numberToName;
      nameToNumber = x.nameToNumber;
      next();
    } else if (trackName) {
        if (x.meta && x.meta.Symbol && x.meta.Symbol === 'EssenceElement' &&
                x.detail && x.detail.Track &&
                nameToNumber[trackName] === parseInt(x.detail.Track, 16)) {
        var track = cachedTracks[parseInt(x.detail.Track, 16)];
        if (track) {
          x.track = track.track;
          x.description = track.description;
          x.startTimecode = track.startTimecode;
        }
        push(null, x);
        next();
      } else {
        next();
      }
    } else if (x.meta && x.meta.Symbol && x.meta.Symbol === 'EssenceElement') {
      var track = x.detail && x.detail.Track && cachedTracks[parseInt(x.detail.Track, 16)];
      if (track) { // decorate if information is available
        x.track = track.track;
        x.description = track.description;
        x.startTimecode = track.startTimecode;
      }
      push(null, x);
      next();
    } else {
      next(); // Filtering ... don't push
    }
  }
  return H.pipeline(H.consume(filterator));
};

module.exports = essenceFilter;
