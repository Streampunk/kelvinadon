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
  function buildTrackCache (preface) {
    var essenceSources = preface.ContentStorageObject.Packages.filter(function (x) {
      return x.ObjectClass === 'SourcePackage' &&
          x.PackageTracks.some(function (y) {
        return y.EssenceTrackNumber > 0;
      })
    });
    essenceSources.forEach(function (src) {
      var trackIDMap = { };
      var startTimecode = null;
      src.PackageTracks.forEach(function (t) {
        if (t.EssenceTrackNumber) {
          emmy.cachedTracks[t.EssenceTrackNumber] = { srcID: src.PackageID, track : t, index : 0 };
          trackIDMap[t.TrackID] = t.EssenceTrackNumber;
        }
        if (t.TrackSegment && Array.isArray(t.TrackSegment.ComponentObjects) &&
              t.TrackSegment.ComponentObjects.length >= 1 &&
              t.TrackSegment.ComponentObjects[0].ObjectClass === 'Timecode') {
          startTimecode = t.TrackSegment.ComponentObjects[0];
        }
      });
      if (src.EssenceDescription.ObjectClass === 'MultipleDescriptor') {
        Object.keys(src.EssenceDescription.FileDescriptors).forEach(function (key) {
          var descriptor = src.EssenceDescription.FileDescriptors[key];
          if (descriptor.LinkedTrackID) {
            emmy.cachedTracks[trackIDMap[descriptor.LinkedTrackID]].description = descriptor;
          }
        });
      } else {
        Object.keys(trackIDMap).forEach(function (key) {
          emmy.cachedTracks[trackIDMap[key]].push(src.EssenceDescription);
        });
      }
      if (startTimecode) {
        Object.keys(emmy.cachedTracks).forEach(function (tid) {
          cachedTracks[tid].startTimecode = startTimecode;
        });
      }
    });
    Object.keys(emmy.cachedTracks).forEach(function (t) {
      switch (t >>> 24) {
      case 0x05:
      case 0x15:
        numberToName[t] = `picture${t & 0xff}`; break;
      case 0x06:
      case 0x16:
        numberToName[t] = `sound${t & 0xff}`; break;
      case 0x07:
      case 0x17:
        numberToName[t] = `data${t & 0xff}`; break;
      case 0x18:
        numberToName[t] = `compound${t & 0xff}`; break;
      default:
        numberToName[t] = `unknown${t & 0xff}`; break;
      };
    });
    Object.keys(numberToName).forEach(function (x) {
      nameToNumber[numberToName[x]] = x;
    });
  };

  var emmyPhone = function (klv) {
    if (klv.ObjectClass && klv.ObjectClass === 'Preface') {
      buildTrackCache(klv);
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
    return Object.names(nameToNumber);
  };
  emitter.getTrackDetails = function (name) {
    if (typeof trackID === 'number') {
      return cachedTracks[trackID];
    } else if (typeof trackID === 'string') {
      if (isNaN(parseInt(name, 16)))
        return cachedTracks[nameToNumber[trackID]];
      else
        return cachedTracks[parseInt(name, 16)];
    } else {
      return undefined;
    }
  }
  return H.pipeline(H.doto(emmyPhone));
};

module.exports = emmyiser;
