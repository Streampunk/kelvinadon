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

var fs = require('fs');
var ulToUUID = require('./meta.js').ulToUUID;

var overrideDefsFile = (process.argv[2]) ? process.argv[2] :
  __dirname + '/../lib/OverrideDefs.json';

var primerPack = {
  Symbol: 'PrimerPack',
  Name: 'PrimerPack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01050100',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition',
  PackOrder: [ 'LocalTagEntryBatch' ]
};

var localTagEntry = {
  Symbol: 'LocalTagEntry',
  Name: 'LocalTagEntry',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.01000000',
  Description: '',
  Members: {
    Name: [
      'LocalTag',
      'UID'
    ],
    Type: [
      'UInt16',
      'AUID'
    ]
  },
  MetaType: 'TypeDefinitionRecord',
};

var localTagEntryBatchProperty = {
  Symbol: 'LocalTagEntryBatch',
  Name: 'LocalTagEntry Batch',
  Identification: 'urn:smpte:ul:060e2b34.01010105.06010107.15000000',
  Description: '',
  MemberOf: 'PrimerPack',
  Type: 'LocalTagEntryBatch',
  IsOptional: false,
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var localTagEntryBatchType = {
  Symbol: 'LocalTagEntryBatch',
  Name: 'LocalTagEntryBatch',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.03000000',
  Description: '',
  ElementType: 'LocalTagEntry',
  MetaType: 'TypeDefinitionSet'
};

var randomIndexItemArray = {
  Symbol: 'RandomIndexItemArray',
  Name: 'RandomIndexItemArray',
  Identification: 'urn:smpte:ul:060e2b34.01040101.0f721102.04000000',
  Description: '',
  ElementType: 'RandomIndexItem',
  MetaType: 'TypeDefinitionVariableArray'
};

var randomIndexItem = {
  Symbol: 'RandomIndexItem',
  Name: 'RandomIndexItem',
  Identification: 'urn:smpte:ul:060e2b34.01040101.0f721102.05000000',
  Description: '',
  Members: {
    Name: [
      'BodySID',
      'ByteOffset'
    ],
    Type: [
      'UInt32',
      'UInt64'
    ]
  },
  MetaType: 'TypeDefinitionRecord'
};

var indexEntryArray = {
  Symbol: 'IndexEntryArray',
  Name: 'IndexEntryArray',
  Identification: 'urn:smpte:ul:060e2b34.01040101.0f721102.06000000',
  Description: '',
  ElementType: 'IndexEntry',
  MetaType: 'TypeDefinitionVariableArray'
};

var indexEntry = {
  Symbol: 'IndexEntry',
  Name: 'IndexEntry',
  Identification: 'urn:smpte:ul:060e2b34.01040101.0f721102.07000000',
  Description: '',
  Members: {
    Name: [
      'TemporalOffset',
      'KeyFrameOffset',
      'Flags',
      'StreamOffset'
    ],
    Type: [
      'Int8',
      'Int8',
      'UInt8',
      'UInt64'
    ]
  },
  MetaType: 'TypeDefinitionRecord'
};

var deltaEntryArray = {
  Symbol: 'DeltaEntryArray',
  Name: 'DeltaEntryArray',
  Identification: 'urn:smpte:ul:060e2b34.01040101.0f721102.08000000',
  Description: '',
  ElementType: 'DeltaEntry',
  MetaType: 'TypeDefinitionVariableArray'
};

var deltaEntry = {
  Symbol: 'DeltaEntry',
  Name: 'DeltaEntry',
  Identification: 'urn:smpte:ul:060e2b34.01040101.0f721102.09000000',
  Description: '',
  Members: {
    Name: [
      'PosTableIndex',
      'Slice',
      'ElementDelta'
    ],
    Type: [
      'Int8',
      'UInt8',
      'UInt32'
    ]
  },
  MetaType: 'TypeDefinitionRecord'
};

var randomIndexPack = {
  Symbol: 'RandomIndexPack',
  Name: 'RandomIndexPack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01110100',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition',
  PackOrder: [ 'PartitionIndex', 'Length' ]
};

var ripLength = {
  Symbol: 'Length',
  Name: 'Length',
  Identification: 'urn:smpte:ul:060e2b34.01010104.04061001.00000000',
  Description: '',
  MemberOf: 'RandomIndexPack',
  Type: 'UInt32',
  IsOptional: false,
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var partitionIndex = {
  Symbol: 'PartitionIndex',
  Name: 'PartitionIndex',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.0a000000',
  Description: '',
  MemberOf: 'RandomIndexPack',
  Type: 'RandomIndexItemArray',
  IsOptional: false,
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var indexTableSegment = {
  Symbol: 'IndexTableSegment',
  Name: 'IndexTableSegment',
  Identification: 'urn:smpte:ul:060e2b34.02060101.0d010201.01100100',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var vbeByteCount = {
  Symbol: 'VBEByteCount',
  Name: 'VBEByteCount',
  Identification: 'urn:smpte:ul:060e2b34.0101010a.04060205.00000000',
  Description: '',
  LocalIdentification: 16144,
  MemberOf: 'IndexTableSegment',
  IsOptional: true,
  Type: 'UInt64',
  MetaType: 'PropertyDefinition'
};

var extStartOffset = {
  Symbol: 'ExtStartOffset',
  Name: 'ExtStartOffset',
  Identification: 'urn:smpte:ul:060e2b34.0101010a.04060204.00000000',
  Description: '',
  LocalIdentification: 16143,
  MemberOf: 'IndexTableSegment',
  IsOptional: true,
  Type: 'UInt64',
  MetaType: 'PropertyDefinition'
};

var indexStartPosition = {
  Symbol: 'IndexStartPosition',
  Name: 'Index Start Position',
  Identification: 'urn:smpte:ul:060e2b34.01010105.07020103.010a0000',
  Description: '',
  LocalIdentification: 16140,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'PositionType',
  MetaType: 'PropertyDefinition'
};

var indexEditRate = {
  Symbol: 'IndexEditRate',
  Name: 'Index Edit Rate',
  Identification: 'urn:smpte:ul:060e2b34.01010105.05300406.00000000',
  Description: '',
  LocalIdentification: 16139,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'Rational',
  MetaType: 'PropertyDefinition'
};

var bodySIDProp = {
  Symbol: 'BodySID',
  Name: 'BodySID',
  Identification: 'urn:smpte:ul:060e2b34.01010104.01030404.00000000',
  Description: '',
  LocalIdentification: 16135,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'UInt32',
  MetaType: 'PropertyDefinition'
};

var editUnitByteCount = {
  Symbol: 'EditUnitByteCount',
  Name: 'Edit Unit Byte Count',
  Identification: 'urn:smpte:ul:060e2b34.01010104.04060201.00000000',
  Description: '',
  LocalIdentification: 16133,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'UInt32',
  MetaType: 'PropertyDefinition'
};

var indexEntryArrayProp = {
  Symbol: 'IndexEntryArray',
  Name: 'Index Entry Array',
  Identification: 'urn:smpte:ul:060e2b34.01010105.04040402.05000000',
  Description: '',
  LocalIdentification: 16138,
  MemberOf: 'IndexTableSegment',
  IsOptional: true,
  Type: 'IndexEntryArray',
  MetaType: 'PropertyDefinition'
};

var indexSIDProp = {
  Symbol: 'IndexSID',
  Name: 'IndexSID',
  Identification: 'urn:smpte:ul:060e2b34.01010104.01030405.00000000',
  Description: '',
  LocalIdentification: 16134,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'UInt32',
  MetaType: 'PropertyDefinition'
};

var sliceCount = {
  Symbol: 'SliceCount',
  Name: 'Slice Count',
  Identification: 'urn:smpte:ul:060e2b34.01010104.04040401.01000000',
  Description: '',
  LocalIdentification: 16136,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'UInt8',
  MetaType: 'PropertyDefinition'
};

var posTableCount = {
  Symbol: 'PosTableCount',
  Name: 'PosTableCount',
  Identification: 'urn:smpte:ul:060e2b34.01010105.04040401.07000000',
  Description: '',
  LocalIdentification: 16142,
  MemberOf: 'IndexTableSegment',
  IsOptional: true,
  Type: 'UInt8',
  MetaType: 'PropertyDefinition'
};

var deltaEntryArrayProp = {
  Symbol: 'DeltaEntryArray',
  Name: 'Delta Entry Array',
  Identification: 'urn:smpte:ul:060e2b34.01010105.04040401.06000000',
  Description: '',
  LocalIdentification: 16137,
  MemberOf: 'IndexTableSegment',
  IsOptional: true,
  Type: 'DeltaEntryArray',
  MetaType: 'PropertyDefinition'
};

var indexDuration = {
  Symbol: 'IndexDuration',
  Name: 'Index Duration',
  Identification: 'urn:smpte:ul:060e2b34.01010105.07020201.01020000',
  Description: '',
  LocalIdentification: 16141,
  MemberOf: 'IndexTableSegment',
  IsOptional: false,
  Type: 'LengthType',
  MetaType: 'PropertyDefinition'
};

var partitionPack = {
  Symbol: 'PartitionPack',
  Name: 'PartitionPack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01000000',
  Description: '',
  IsConcrete: false,
  MetaType: 'ClassDefinition',
  PackOrder: [
    'MajorVersion', 'MinorVersion', 'KAGSize', 'ThisPartition',
    'PreviousPartition', 'FooterPartition', 'HeaderByteCount',
    'IndexByteCount', 'IndexSID', 'BodyOffset', 'BodySID',
    'OperationalPattern', 'EssenceContainers'
  ]
};

var footerPartition = {
  Symbol: 'FooterPartition',
  Name: 'FooterPartition',
  Identification: 'urn:smpte:ul:060e2b34.01010104.06101005.01000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt64',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var thisPartition = {
  Symbol: 'ThisPartition',
  Name: 'ThisPartition',
  Identification: 'urn:smpte:ul:060e2b34.01010104.06101003.01000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt64',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var previousPartition = {
  Symbol: 'PreviousPartition',
  Name: 'PreviousPartition',
  Identification: 'urn:smpte:ul:060e2b34.01010104.06101002.01000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt64',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var essenceContainers = {
  Symbol: 'EssenceContainers',
  Name: 'EssenceContainers',
  Identification: 'urn:smpte:ul:060e2b34.01010105.01020210.02010000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'AUIDSet',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var bodyOffset = {
  Symbol: 'BodyOffset',
  Name: 'BodyOffset',
  Identification: 'urn:smpte:ul:060e2b34.01010104.06080102.01030000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt64',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var bodySIDPPProp = {
  Symbol: 'BodySID',
  Name: 'BodySID',
  Identification: 'urn:smpte:ul:060e2b34.01010104.01030404.00000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt32',
  LocalIdentification: 16135,
  MetaType: 'PropertyDefinition'
};

var headerByteCount = {
  Symbol: 'HeaderByteCount',
  Name: 'HeaderByteCount',
  Identification: 'urn:smpte:ul:060e2b34.01010104.04060901.00000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt64',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var indexSIDPPProp = {
  Symbol: 'IndexSID',
  Name: 'IndexSID',
  Identification: 'urn:smpte:ul:060e2b34.01010104.01030405.00000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt32',
  LocalIdentification: 16134,
  MetaType: 'PropertyDefinition'
};

var indexByteCount = {
  Symbol: 'IndexByteCount',
  Name: 'IndexByteCount',
  Identification: 'urn:smpte:ul:060e2b34.01010104.04060902.00000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt64',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var kagSize = {
  Symbol: 'KAGSize',
  Name: 'KAGSize',
  Identification: 'urn:smpte:ul:060e2b34.01010104.03010201.09000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt32',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var operationalPattern = {
  Symbol: 'OperationalPattern',
  Name: 'Operational Pattern',
  Identification: 'urn:smpte:ul:060e2b34.01010105.01020203.00000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'AUID',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var majorVersion = {
  Symbol: 'MajorVersion',
  Name: 'Major Version',
  Identification: 'urn:smpte:ul:060e2b34.01010104.03010201.06000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt16',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var minorVersion = {
  Symbol: 'MinorVersion',
  Name: 'Minor Version',
  Identification: 'urn:smpte:ul:060e2b34.01010104.03010201.07000000',
  Description: '',
  MemberOf: 'PartitionPack',
  IsOptional: false,
  Type: 'UInt16',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var headerOpenIncompletePartitionPack = {
  Symbol: 'HeaderOpenIncompletePartitionPack',
  Name: 'Header Open Incomplete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01020100',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var headerClosedIncompletePartitionPack = {
  Symbol: 'HeaderClosedIncompletePartitionPack',
  Name: 'Header Closed Incomplete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01020200',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var headerOpenCompletePartitionPack = {
  Symbol: 'HeaderOpenCompletePartitionPack',
  Name: 'Header Open Complete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01020300',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var headerClosedCompletePartitionPack = {
  Symbol: 'HeaderClosedCompletePartitionPack',
  Name: 'Header Closed Complete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01020400',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var bodyOpenIncompletePartitionPack = {
  Symbol: 'BodyOpenIncompletePartitionPack',
  Name: 'Body Open Incomplete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01030100',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var bodyClosedIncompletePartitionPack = {
  Symbol: 'BodyClosedIncompletePartitionPack',
  Name: 'Body Closed Incomplete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01030200',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var bodyOpenCompletePartitionPack = {
  Symbol: 'BodyOpenCompletePartitionPack',
  Name: 'Body Open Complete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01030300',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var bodyClosedCompletePartitionPack = {
  Symbol: 'BodyClosedCompletePartitionPack',
  Name: 'Body Closed Complete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01030400',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var footerClosedIncompletePartitionPack = {
  Symbol: 'FooterClosedIncompletePartitionPack',
  Name: 'Footer Closed Incomplete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01040200',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var footerClosedCompletePartitionPack = {
  Symbol: 'FooterClosedCompletePartitionPack',
  Name: 'Footer Closed Complete Partition Pack',
  Identification: 'urn:smpte:ul:060e2b34.02050101.0d010201.01040400',
  Description: '',
  ParentClass: 'PartitionPack',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var klvFill = {
  Symbol: 'KLVFill',
  Name: 'KLV Fill',
  Identification: 'urn:smpte:ul:060e2b34.01010102.03010210.01000000',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var klvFillOld = {
  Symbol: 'KLVFillOld',
  Name: 'KLV Fill Old',
  Identification: 'urn:smpte:ul:060e2b34.01010101.03010210.01000000',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var uint64 = {
  Symbol: 'UInt64',
  Name: 'UInt64',
  Identification: 'urn:smpte:ul:060e2b34.01040101.01010400.00000000',
  Description: '',
  Size: 8,
  IsSigned: false,
  MetaType: 'TypeDefinitionInteger'
};

var essenceElement = {
  Symbol: 'EssenceElement',
  Name: 'Essence Element',
  Identification: 'urn:smpte:ul:060e2b34.01020101.0d010301.00000000',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition'
};

var instanceUID = {
  Symbol: 'InstanceUID',
  Name: ' InstanceUID',
  Identification: 'urn:smpte:ul:060e2b34.01010101.01011502.00000000',
  Description: '',
  MemberOf: 'InterchangeObject',
  IsOptional: true,
  Type: 'AUID',
  LocalIdentification: 0x3c0a,
  MetaType: 'PropertyDefinition'
};

var systemMetadata = {
  Symbol: 'SystemMetadata',
  Name: 'SystemMetadata',
  Identification: 'urn:smpte:ul:060e2b34.027f0101.0d010301.04010100',
  Description: '',
  IsConcrete: true,
  MetaType: 'ClassDefinition',
  PackOrder: [ 'Bitmap', 'Rate', 'Type', 'ChannelHandle', 'ContinuityCount',
    'Label', 'CreationDate', 'UserDate' ]
};

var system17byteValue = {
  Symbol: 'UInt8Array17',
  Name: 'UInt8Array17',
  'Identification': 'urn:smpte:ul:060e2b34.01040101.0f721102.04010000',
  'Description': '',
  'ElementCount': 17,
  'ElementType': 'UInt8',
  'MetaType': 'TypeDefinitionFixedArray'
};

var bitmap = {
  Symbol: 'Bitmap',
  Name: 'Bitmap',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04020000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt8',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var rate = {
  Symbol: 'Rate',
  Name: 'Rate',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04030000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt8',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var smType = {
  Symbol: 'Type',
  Name: 'Type',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04040000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt8',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var channelHandle = {
  Symbol: 'ChannelHandle',
  Name: 'Channel Handle',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04050000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt16',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var contCount = {
  Symbol: 'ContinuityCount',
  Name: 'Continuity Count',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04060000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt16',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var smLabel = {
  Symbol: 'Label',
  Name: 'Label',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04070000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'AUID',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var smCreationDate = {
  Symbol: 'CreationDate',
  Name: 'Creation Date',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04080000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt8Array17',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var smUserDate = {
  Symbol: 'UserDate',
  Name: 'User Date',
  Identification: 'urn:smpte:ul:060e2b34.01010101.0f721102.04090000',
  Description: '',
  MemberOf: 'SystemMetadata',
  IsOptional: false,
  Type: 'UInt8Array17',
  LocalIdentification: 0,
  MetaType: 'PropertyDefinition'
};

var vbiDataDescriptor = {
  Symbol: 'VBIDataDescriptor',
  Name: 'VBI Data Descriptor',
  Identification: 'urn:smpte:ul:060e2b34.02060101.0d010101.01015b00',
  Description: '',
  Parent: 'DataEssenceDescriptor',
  MetaType: 'ClassDefinition'
};

var ancDataDescriptor = {
  Symbol: 'ANCDataDescriptor',
  Name: 'ANC Data Descriptor',
  Identification: 'urn:smpte:ul:060e2b34.02060101.0d010101.01015c00',
  Description: '',
  Parent: 'DataEssenceDescriptor',
  MetaType: 'ClassDefinition'
};

var metaDefs = [ // Primer Pcak defs
  //localTagEntry, localTagEntryBatchProperty,
  //localTagEntryBatchType, primerPack,
  // RIP defs
  randomIndexItem, randomIndexItemArray, partitionIndex, ripLength,
  randomIndexPack,
  // Index Segment defs
  indexEntry, indexEntryArray, deltaEntry, deltaEntryArray,
  //vbeByteCount, extStartOffset, indexStartPosition, indexEditRate,
  //bodySIDProp, editUnitByteCount, indexEntryArrayProp, indexSIDProp,
  //sliceCount, posTableCount, deltaEntryArrayProp, indexDuration,
  //indexTableSegment,
  // PartitionPack
  //footerPartition, thisPartition, previousPartition, essenceContainers,
  //bodyOffset, bodySIDPPProp, headerByteCount, indexSIDPPProp, indexByteCount,
  //kagSize, operationalPattern, majorVersion, minorVersion,
  //partitionPack, headerOpenIncompletePartitionPack,
  //headerClosedIncompletePartitionPack, headerOpenCompletePartitionPack,
  //headerClosedCompletePartitionPack,
  //bodyOpenIncompletePartitionPack, bodyClosedIncompletePartitionPack,
  //bodyOpenCompletePartitionPack, bodyClosedCompletePartitionPack,
  //footerClosedIncompletePartitionPack, footerClosedCompletePartitionPack,
  // System metadata
  system17byteValue, bitmap, rate, smType, channelHandle, contCount,
  smLabel, smCreationDate, smUserDate, systemMetadata,
  // Fill & missing
  //klvFill, klvFillOld, uint64, essenceElement, instanceUID,
  //vbiDataDescriptor, ancDataDescriptor
];

var metaDefsByID = [ ];

metaDefs.forEach((def) => {
  if (def.Identification) {
    def.UUID = ulToUUID(def.Identification);
  } else {
    console.error('Found definition without identification', def);
  }
  if (def.MemberOf && !Array.isArray(def.MemberOf)) {
    def.MemberOf = [ def.MemberOf ];
  }
});

fs.writeFileSync(overrideDefsFile, JSON.stringify(metaDefs, null, 2));
