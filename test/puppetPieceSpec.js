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

const tape = require('tape');
const H = require('highland');
const pieceMaker = require('../pipelines/pieceMaker.js');
// const puppeteer = require('../pipelines/puppeteer.js');
// const packetator = require('../pipelines/packetator.js');
const meta = require('../util/meta.js');

var testPreface =  {
  ObjectClass: 'Preface',
  InstanceID: '10c49680-e6dc-11e5-b902-080046998cb7',
  FileLastModified: '2016-03-10T16:20:55.000Z',
  FormatVersion: [ 1, 3 ],
  IdentificationList: [ '10c4968a-e6dc-11e5-8005-080046998cb7' ],
  ContentStorageObject: {
    ObjectClass: 'ContentStorage',
    InstanceID: '10c4969e-e6dc-11e5-94cd-080046998cb7',
    Packages: [ {
      ObjectClass: 'MaterialPackage',
      InstanceID: '10c496b2-e6dc-11e5-956b-080046998cb7',
      PackageID: [
        '060a2b34-0101-0105-0101-0d4313000000',
        '4dc362ae-5774-05c7-0800-460202998cb7' ],
      CreationTime: '2016-03-10T16:20:55.000Z',
      PackageLastModified: '2016-03-10T16:20:55.000Z',
      PackageTracks: [ ]
    } ],
    EssenceDataObjects: [ {
      ObjectClass: 'EssenceData',
      InstanceID: '10c496a8-e6dc-11e5-93b1-080046998cb7',
      LinkedPackageID: [
        '060a2b34-0101-0105-0101-0d4313000000',
        '4ec362ae-5774-05c7-0800-460202998cb7' ],
      IndexStreamID: 1,
      EssenceStreamID: 2 } ]
  },
  OperationalPattern: '060e2b34-0401-0101-0d01-020101010900',
  EssenceContainers: [
    '060e2b34-0401-010a-0d01-030102106001',
    '060e2b34-0401-0101-0d01-030102060300',
    '060e2b34-0401-0109-0d01-0301020e0000',
    '060e2b34-0401-0103-0d01-0301027f0100' ],
  DescriptiveSchemes: [ '060e2b34-0401-010c-0d01-040104010100' ]
};

tape('Turn nested preface into separate objects', t => {
  H([testPreface])
    .through(pieceMaker())
    .errors(t.fail)
    .toArray(a => {
      t.ok(a.every(x => typeof x === 'object'), 'every item produced is an object.');
      t.equal(a.length, 5, 'array has expected length.');
      t.equal(a[0].ObjectClass, 'PrimerPack', 'first element is a primer pack.');
      t.equal(a[1].ObjectClass, 'Preface', 'second element is a preface.');
      t.equal(a[2].ObjectClass, 'ContentStorage', 'third element is content storage.');
      t.equal(a[3].ObjectClass, 'MaterialPackage', 'fourth element is material package.');
      t.equal(a[4].ObjectClass, 'EssenceData', 'fifth element is essence data.');
      var primer = meta.resetPrimer(a[0]);
      var propProm = [];
      a.forEach(o => {
        if (o.ObjectClass !== 'PrimerPack') {
          // console.log(Object.keys(o).filter(k => k !== 'ObjectClass').map(prop =>
          //   meta.resolveByName('PropertyDefinition', prop).then(x => x, console.error)));
          propProm = propProm.concat(Object.keys(o).filter(k => k !== 'ObjectClass').map(prop =>
            meta.resolveByName('PropertyDefinition', prop)));
        }
      });
      Promise.all(propProm)
        .then(props => {
          props.forEach(prop => {
            t.ok(primer[prop.LocalIdentification],
              `primer pack contains tag for ${prop.Symbol}.`);
            t.ok(primer[meta.ulToUUID(prop.Identification)],
              `primer pack contains id for ${prop.Symbol}.`);
          });
          t.end();
        })
        .catch(t.fail);
    });
});

// TODO roundtrip test without relying on header byte count length
// tape('Roundtrip preface into objects and back', t => {
//   H([testPreface])
//     .through(pieceMaker())
//     .through(packetator())
//     .errors(e => { console.error('+++', e); t.fail(e); })
//     .toArray(a => {
//       console.log(a);
//       t.end();
//     });
// });
