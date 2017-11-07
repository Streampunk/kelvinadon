# Kelvinadon

Kelvinadon is a cross-platform streaming library for working with [Material Exchange Format (MXF)](https://en.wikipedia.org/wiki/Material_Exchange_Format) files or streams in [Node.js](https://nodejs.org/en/). Kelvinadon works with [highland.js](http://highlandjs.org/) to provide a means to process MXF data in stream form with back pressure.

The library supports reading _MXF data_ as a stream to a stream of Javascript objects - easy to format as JSON - and writing the same streams of Javascript objects back to MXF. The benefits of this approach are:

* easy to examine and fix up and make small changes to MXF data from Javascript environments - streaming from and to files, object storage and even HTTP(S);
* stream essence out of an MXF container for playing of transformation to other formats;
* making MXF data accessible in large-scale artificial intelligence environments for machine learning and deep learning capabilities.

An MXF file dumper CLI tool `kelvinadump` is provided. Reading part of a stream, say just a single partition, will also work subject to sufficient metadata being provided. Otherwise, this package is a low-level library and does not contain any of the following facilities:

* from just raw essence payload(s) and limited technical description, create a correctly structured MXF file, files or data stream;
* resolve index tables to byte offsets in the stream;
* contain any logic for processing multi-file MXF formats such as AMWA AS-02 of SMPTE IMF.

All of the above features can be built out of this package much more easily than starting from scratch and Streampunk Media will be considering how to build these as user requirements emerge. This implementation was created to allow MXF files to be used from the [_dynamorse_ file nodes](https://github.com/Streampunk/node-red-contrib-dynamorse-file-io) of an IoT framework for professional media processing.

One particular feature of this application is that the metadata dictionaries are loaded on-the-fly and can be changed or updated. Facilities to allow use update of these dictionaries are being added.

The name _kelvinadon_ is a play on the format of MXF files using a KLV structure and a nod to [Sir William Thomson, 1st Baron Kelvin](https://en.wikipedia.org/wiki/William_Thomson,_1st_Baron_Kelvin) - this library being developed in Scotland based on the highland library. This is an add on module for other Streampunk Media projects.

## Installation

Kelvinadon is intended for use with the latest long term support (LTS) version of [Node.js](https://nodejs.org/en/), which must be installed first. Otherwise, the library is pure Javascript and does not require a binding to C++ library. To install kelvinadon globally and use the simple MXF file dumper `kelvinadump`:

    npm install -g kelvinadon

Uses or Mac or Linux platforms may need to prepend `sudo` to the above.

To install locally for use in your own project:

    npm install --save kelvinadon

## Dumping a file

To dump an MXF File `myfile.mxf` and see all the KLV structures inside of it, install kelvinadon as a global dependency and run:

    kelvinadump myfile.mxf

Here is an example output for one KLV packet:

```javascript
{
  key: '060e2b34-0205-0101-0d01-020101040400',
  length: 136,
  value: [ <Buffer 00 01 00 02 00 00 02 00 00 00 00 00 04 d3 84 00 00 00 00 00 04 9d 64 00 00 00 00 00 04 d3 84 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 02 00 00 00 ... > ],
  lengthLength: 4,
  filePos: 80970752,
  meta:
   { Symbol: 'FooterClosedCompletePartitionPack',
     Name: 'Footer Closed Complete Partition Pack',
     Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01040400',
     Description: '',
     ParentClass: 'PartitionPack',
     IsConcrete: true,
     MetaType: 'ClassDefinition' },
  detail:
   { ObjectClass: 'FooterClosedCompletePartitionPack',
     MajorVersion: 1,
     MinorVersion: 2,
     KAGSize: 512,
     ThisPartition: 80970752,
     PreviousPartition: 77423616,
     FooterPartition: 80970752,
     HeaderByteCount: 0,
     IndexByteCount: 512,
     IndexSID: 1,
     BodyOffset: 0,
     BodySID: 0,
     OperationalPattern: '060e2b34-0401-0101-0d01-020101010900',
     EssenceContainers:
      [ '060e2b34-0401-0102-0d01-030102046001',
        '060e2b34-0401-0109-0d01-0301020e0000',
        '060e2b34-0401-0101-0d01-030102060300' ] } }
```

Each packet has:
* `key` 16-byte identifier;
* `length` length of the following value;
* `value` array of chunks of data that make up the value of the packet;
* `lengthLength` number of bytes used to carry the length value;
* `filePos` absolute file position of this KLV packet in the overall stream;
* `meta` if the key is recognized, the meta definition of the corresponding data type;
* `detail` application of the meta definition used to decode the buffer and interpret the data it contains;
* `props` (not shown) for local sets, an array or arrays describing each local tag found in a local set.

Some command line options have been provided to enable a user to configure the structure of the output. Run `kelvinadump --help` for more details.

## From another application

Kelvinadon has two modes that it can be used in within an application:

1. As an event emitter, with the data within the stream split into _partitions_, _metadata_, _indexes_ and _essence by track_.
2. Via [highland.js](http://highlandjs.org/), allowing back pressure to be applied via the building blocks provided.

### Event emitter

To use kelvinadon as a Node.js event emitter, install it as a local dependency and follow the example below:

```javascript
var klv = require('kelvinadon');
var fs = require('fs');

// Create a new MXF event emitter for a Node.js readable stream
// Files, HTTP and other stream sources are possible.
var mxfEvents = new klv.MXFEmitter(fs.createReadStream('myfile.mxf'));

// Listen for errors
mxfEvents.on('error', function (e) { console.error(e); });

// Receive any header metadata sets (optional)
mxfEvents.on('metadata', function (preface) {
  // Process a structured object containing the metadata preface & its children  
});

// Listen for information on a pictire track
mxfEvents.on('picture0', function (data) {
  // Data is an object containing the Buffer value, length, track details, descriptor and
  // associated timecode track for the media
});

// Listen for information on a sound track
mxfEvents.on('sound0', function (data) {
  // Data is an object containing the Buffer value, length, track details, descriptor and
  // associated timecode track for the media
});

// Event called at the end of the stream
mxfEvents.on('done', function () { console.log('Streaming complete.'); });

```

The track names are available with the metadata event by calling `mxfEvents.getTrackList()`. Typically, these are `picture0`, `sound0`, `sound1`, ... , `data0` etc.. Alternatively, you can use the `essence` event to listen for all essence elements in the stream. Note that a sound track may contain more than one channel.

The design is such that events are fairly self-contained, providing enough information that a decoder could process them standalone, including the count of the index of this element within its stream, the source package identifier, file descriptor, track details and the start timecode of the same package. Here is an example of the event data sent for picture data:

```javascript
{ trackNumber: '15010500',
  value: <Buffer 00 00 01 00 02 5a 48 4b b8 00 00 01 b5 85 45 2f 9c 00 00 00 01 01 0a 56 02 00 40 08 04 ca c0 00 00 01 02 0a 56 02 00 40 08 04 ca c0 00 00 01 03 0a 56 ... >,
  length: 250112,
  element: [ 0, 1 ], // First element (0-based) of one elements
  sourcePackageID: // UMID split into two separate UUIDs
  [ '060a2b34-0101-0105-0101-0f4313000000',
    '2eef6798-5614-141e-7a31-00b00901b339' ],
  count: 250,
  track:
   { ObjectClass: 'TimelineTrack',
     InstanceID: '2eef6aa4-5614-141e-25c2-00b00901b339',
     TrackID: 2,
     EssenceTrackNumber: 352388352,
     TrackName: 'Source Package: Video Track #2',
     TrackSegment:
      { ObjectClass: 'Sequence',
        InstanceID: '2eef6db0-5614-141e-2f6d-00b00901b339',
        ComponentDataDefinition: '060e2b34-0401-0101-0103-020201000000',
        ComponentLength: 250,
        ComponentObjects:
         [ { ObjectClass: 'SourceClip',
             InstanceID: '2eef6e50-5614-141e-6b35-00b00901b339',
             ComponentDataDefinition: '060e2b34-0401-0101-0103-020201000000',
             ComponentLength: 250,
             StartPosition: 0,
             SourcePackageID:
              [ '00000000-0000-0000-0000-000000000000',
                '00000000-0000-0000-0000-000000000000' ],
             SourceTrackID: 0 } ] },
     EditRate: [ 25, 1 ],
     Origin: 0 },
  description:
   { ObjectClass: 'MPEGVideoDescriptor',
     InstanceID: '2eef6d10-5614-141e-50f2-00b00901b339',
     LinkedTrackID: 2,
     SampleRate: [ 25, 1 ],
     ContainerFormat: '060e2b34-0401-0102-0d01-030102046001',
     SignalStandard: 'SMPTE274',
     FrameLayout: 'SeparateFields',
     StoredWidth: 1920,
     StoredHeight: 544,
     StoredF2Offset: 0,
     SampledWidth: 1920,
     SampledHeight: 544,
     SampledXOffset: 0,
     SampledYOffset: 0,
     DisplayHeight: 540,
     DisplayWidth: 1920,
     DisplayXOffset: 0,
     DisplayYOffset: 0,
     DisplayF2Offset: 0,
     ImageAspectRatio: [ 16, 9 ],
     ActiveFormatDescriptor: 0,
     VideoLineMap: [ 21, 584 ],
     PictureCompression: '060e2b34-0401-0103-0401-020201040300',
     ComponentDepth: 8,
     HorizontalSubsampling: 2,
     VerticalSubsampling: 1,
     LowDelay: false,
     ClosedGOP: true,
     MaxGOP: 12,
     MaxBPictureCount: 2,
     ProfileAndLevel: 130,
     BitRate: 50000000 },
  startTimecode:
   { ObjectClass: 'Timecode',
     InstanceID: '2eef6a04-5614-141e-4daa-00b00901b339',
     ComponentDataDefinition: '060e2b34-0401-0101-0103-020101000000',
     ComponentLength: 250,
     FramesPerSecond: 25,
     StartTimecode: 0,
     DropFrame: false } }
```

Details of the `ContainerFormat` and `PictureCompression` properties can be found via the [SMPTE metadata registry](https://smpte-ra.org/smpte-metadata-registry) for [labels](http://smpte-ra.org/sites/default/files/Labels.xml).

### Deeper into the highlands

Under the bonnet, the file dumper `kelvinadump` and event emitter are [highland streams](http://highlandjs.org/). The building blocks of these streams are pipelines exposed by the kelvinadon module. For example, to build a highland version of the event emitter example:

```javascript
var H = require('highland');
var fs = require('fs');
var klv = require('klevinadon');

var base = H(fs.createReadStream(process.argv[2]))
.through(klv.kelviniser())
.through(klv.metatiser())
.through(klv.stripTheFiller)
.through(klv.detailing())
.through(klv.puppeteer())
.through(klv.trackCacher());

base.fork()
 .through(klv.essenceFilter('picture0')) // Track names as per event model
 .doto(H.log)
 .errors(function (e) { console.error(e); })
 .done(function () { console.log('Finished reading picture data.'); });

base.fork()
  .through(klv.essenceFilter('sound0'))  // Track names as per event model
  .doto(H.log)
  .errors(function (e) { console.error(e); })
  .done(function () { console.log('Finished reading sound data.') });
base.resume();
```

#### Reading

The highland pipeline reading stages available are described below and should be applied in the given order:

1. `kelviniser` Turns a byte stream into a stream of raw KLV packets. The input stream is any node readable stream, including HTTP response objects. Also tried with [FTP streams](https://www.npmjs.com/package/ftp).
2. `metatiser` Reads the keys of the KLV stream and adds meta definitions to the KLV packets. See the [lib](/lib) folder for the meta dictionaries in use.
3. `stripTheFiller` Remove any filler elements from the stream (optional).
4. `detailing` Use the meta definition to extract the details from the Buffer value, such as decoding a local set to a metadata value.
5. `puppeteer` Collapse metadata classes into a single preface-object-with-children by resolving local references. The children are removed from the stream and the preface is sent on down the stream without its KLV wrapper.
6. `trackCacher` Cache track details and give names to each metadata track. An object with class `TrackCache` is created and sent on down the stream.
7. `partitionFilter`, `metadataFilter`, `indexFilter` and `essenceFilter`. Filter the stream so that it contains only KLV packets of the given type. A track name can be passed to `essenceFilter` to make it track specific.

If a consumer that is slower than the producer is added to the stream, the producer (e.g. file reader stream) will be slowed down via back pressure.

Also provided is `emmyiser`, the highland side-effect that is the basis of event emitter. This must be placed in the pipeline after the `trackCacher`.

#### Writing

Most highland pipeline reading stages have mirror writing stages that can be used to convert a stream of Javascript objects with embedded buffers back to binary KLV. For example, the `kelviniser` stage has a mirror state `kelvinator` that takes the key, length and value of a `KLVPacket` object and converts it to a Javascript `Buffer`. The writing stages are:

1. `kelvinator` mirrors `kelviniser`: Convert a stream of KLVPacket objects into a stream of Javascript buffers that can be piped into a Node.JS stream, such as a file writing stream, HTTP response or streaming object store API.
2. `packetator` mirrors `detailing`: Convert a stream of _detail_ objects representing local sets, fixed-length packs and essence elements into a stream of KLV packets, creating the key, length and value from the detail.
3. `pieceMaker` mirrors `puppeteer`: Explode a nested preface-object-with-children into a primer pack, a flat preface with _instance uid_ references and a sequence of separate local sets.

The aim is that a stream of MXF can be passed through `kelviniser` to `puppeteer` (without `stripTheFiller`) to make Javascript objects and back through `pieceMaker` to `kelvinator` and the same stream of MXF is produced. Minor tweaks could be made in the middle but note that at this time, no logic is provided to fix up fillers and calculate the impact of a change of offset values or index tables.

Some reading functions have no mirror and that is because they don't need one. Also note that the writing functions are not currently setting the file position property (`filePos`) of KLV packets.

## Status, support and further development

This is prototype software that is not yet suitable for production use. The software is being actively tested and developed.

Contributions can be made via pull requests and will be considered by the author on their merits. Enhancement requests and bug reports should be raised as github issues. For support, please contact [Streampunk Media](http://www.streampunk.media/). For updates follow [@StrmPunkd](https://twitter.com/StrmPunkd) on Twitter.

### Tests

Some basic tests are provided and can be run as follows:

    npm test

## License

This software is released under the Apache 2.0 license. Copyright 2017 Streampunk Media Ltd.
