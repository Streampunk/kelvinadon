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

function emmyiser (emitter) {
  this.cachedTracks = { };
  var numberToName = { };
  var nameToNumber = { };
  var emmy = this;
  var emmyPhone = function (klv) {
    if (klv.ObjectClass && klv.ObjectClass === 'TrackCache') {
      emmy.cachedTracks = klv.cachedTracks;
      numberToName = klv.numberToName;
      nameToNumber = klv.nameToNumber;
      return;
    }
    if (klv.ObjectClass && klv.ObjectClass === 'Preface') {
      return emitter.emit('metadata', klv);
    };
    if (klv.meta.Symbol.endsWith('PartitionPack')) {
      return emitter.emit('partition', klv);
    };
    if (klv.meta.Symbol === 'IndexTableSegment') {
      return emitter.emit('index', klv);
    };
    if (klv.meta.Symbol === 'EssenceElement') {
      var trackID = parseInt(klv.detail.Track, 16);
      var track = emmy.cachedTracks[trackID];
      var output = {
        trackNumber: klv.detail.Track.toString(16),
        value: (klv.value.length === 1) ? klv.value[0] :
          Buffer.concat(klv.value, klv.length),
        length: klv.length,
        element: [ klv.detail.ElementNumber, klv.detail.ElementCount ]
      };
      if (track) {
        output.count = track.index;
        output.track = track.track;
        output.description = track.description;
        if (track.startTimecode) output.startTimecode = track.startTimecode;
        emitter.emit(numberToName[trackID], output);
        track.index++;
      };
      return emitter.emit('essence', output);
    };
  };
  emitter.getTrackList = function () {
    return Object.keys(nameToNumber);
  };
  emitter.getTrackDetails = function (name) {
    if (typeof name === 'number') {
      return cachedTracks[trackID];
    } else if (typeof name === 'string') {
      console.log(nameToNumber, name);
      if (isNaN(parseInt(name, 16)))
        return cachedTracks[nameToNumber[name]];
      else
        return cachedTracks[parseInt(name, 16)];
    } else {
      return undefined;
    }
  }
  return H.pipeline(H.doto(emmyPhone));
};

module.exports = emmyiser;
