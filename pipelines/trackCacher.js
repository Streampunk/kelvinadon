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

function trackCacher() {
  var cachedTracks = { };
  var numberToName = { };
  var nameToNumber = { };
  function buildTrackCache (preface) {
    var essenceSources = preface.ContentStorageObject.Packages.filter(x =>
      x.ObjectClass === 'SourcePackage' &&
          x.PackageTracks.some(y => y.EssenceTrackNumber > 0));
    essenceSources.forEach(src => {
      var trackIDMap = { };
      var startTimecode = null;
      src.PackageTracks.forEach(t => {
        if (t.EssenceTrackNumber) {
          cachedTracks[t.EssenceTrackNumber] = { srcID: src.PackageID, track : t, index : 0 };
          trackIDMap[t.TrackID] = t.EssenceTrackNumber;
        }
        if (t.TrackSegment && Array.isArray(t.TrackSegment.ComponentObjects) &&
              t.TrackSegment.ComponentObjects.length >= 1 &&
              t.TrackSegment.ComponentObjects[0].ObjectClass === 'Timecode') {
          startTimecode = t.TrackSegment.ComponentObjects[0];
        }
      });
      if (src.EssenceDescription.ObjectClass === 'MultipleDescriptor') {
        Object.keys(src.EssenceDescription.FileDescriptors).forEach(key => {
          var descriptor = src.EssenceDescription.FileDescriptors[key];
          if (descriptor.LinkedTrackID) {
            cachedTracks[trackIDMap[descriptor.LinkedTrackID]].description = descriptor;
          }
        });
      } else {
        Object.keys(trackIDMap).forEach(key => {
          cachedTracks[trackIDMap[key]].push(src.EssenceDescription);
        });
      }
      if (startTimecode) {
        Object.keys(cachedTracks).forEach(tid => {
          cachedTracks[tid].startTimecode = startTimecode;
        });
      }
    });
    Object.keys(cachedTracks).forEach(t => {
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
      }
    });
    Object.keys(numberToName).forEach(x => {
      nameToNumber[numberToName[x]] = +x;
    });
  }

  var trackBasher = function (err, x, push, next) {
    if (err) {
      push(err);
      next();
    } else if (x === H.nil) {
      push(null, H.nil);
    } else if (x.ObjectClass && x.ObjectClass === 'Preface') {
      buildTrackCache(x);
      push(null, {
        ObjectClass: 'TrackCache',
        cachedTracks: cachedTracks,
        nameToNumber: nameToNumber,
        numberToName: numberToName
      });
      push(null, x);
      next();
    } else {
      push(null, x);
      next();
    }
  };
  return H.pipeline(H.consume(trackBasher));
}

module.exports = trackCacher;
