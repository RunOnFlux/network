---
id: "modules"
title: "API reference"
sidebar_label: " "
sidebar_position: 99
custom_edit_url: null
---

import FeaturedLinks from 
            "@site/src/components/FeaturedLinks";

### Streamr SDK version 8.5.0 

## Featured Classes 

<FeaturedLinks links={[{"name":"Stream","path":"classes/Stream.md"},{"name":"StreamrClient","path":"classes/StreamrClient.md"},{"name":"Subscription","path":"classes/Subscription.md"}]} category="class" />

## Featured Interfaces

<FeaturedLinks links={[{"name":"Message","path":"interfaces/Message.md"},{"name":"StreamrClientConfig","path":"interfaces/StreamrClientConfig.md"}]} category="interface" />

## Classes

<FeaturedLinks links={[{"name":"EncryptedGroupKey","path":"classes/EncryptedGroupKey.md"},{"name":"EncryptionKey","path":"classes/EncryptionKey.md"},{"name":"MessageID","path":"classes/MessageID.md"},{"name":"MessageRef","path":"classes/MessageRef.md"},{"name":"MessageStream","path":"classes/MessageStream.md"},{"name":"Metric","path":"classes/Metric.md"},{"name":"MetricsContext","path":"classes/MetricsContext.md"},{"name":"Stream","path":"classes/Stream.md"},{"name":"StreamMessage","path":"classes/StreamMessage.md"},{"name":"StreamrClient","path":"classes/StreamrClient.md"},{"name":"Subscription","path":"classes/Subscription.md"}]} category="class" />

## Interfaces

<FeaturedLinks links={[{"name":"ChainConnectionInfo","path":"interfaces/ChainConnectionInfo.md"},{"name":"ConnectivityMethod","path":"interfaces/ConnectivityMethod.md"},{"name":"EthereumNetworkConfig","path":"interfaces/EthereumNetworkConfig.md"},{"name":"ExtraSubscribeOptions","path":"interfaces/ExtraSubscribeOptions.md"},{"name":"Field","path":"interfaces/Field.md"},{"name":"IceServer","path":"interfaces/IceServer.md"},{"name":"JsonPeerDescriptor","path":"interfaces/JsonPeerDescriptor.md"},{"name":"Message","path":"interfaces/Message.md"},{"name":"NetworkConfig","path":"interfaces/NetworkConfig.md"},{"name":"NetworkNodeStub","path":"interfaces/NetworkNodeStub.md"},{"name":"PeerDescriptor","path":"interfaces/PeerDescriptor.md"},{"name":"PrivateKeyAuthConfig","path":"interfaces/PrivateKeyAuthConfig.md"},{"name":"ProviderAuthConfig","path":"interfaces/ProviderAuthConfig.md"},{"name":"PublicPermissionAssignment","path":"interfaces/PublicPermissionAssignment.md"},{"name":"PublicPermissionQuery","path":"interfaces/PublicPermissionQuery.md"},{"name":"PublishMetadata","path":"interfaces/PublishMetadata.md"},{"name":"ResendFromOptions","path":"interfaces/ResendFromOptions.md"},{"name":"ResendLastOptions","path":"interfaces/ResendLastOptions.md"},{"name":"ResendRangeOptions","path":"interfaces/ResendRangeOptions.md"},{"name":"ResendRef","path":"interfaces/ResendRef.md"},{"name":"SearchStreamsOrderBy","path":"interfaces/SearchStreamsOrderBy.md"},{"name":"SearchStreamsPermissionFilter","path":"interfaces/SearchStreamsPermissionFilter.md"},{"name":"StorageNodeAssignmentEvent","path":"interfaces/StorageNodeAssignmentEvent.md"},{"name":"StorageNodeMetadata","path":"interfaces/StorageNodeMetadata.md"},{"name":"StreamCreationEvent","path":"interfaces/StreamCreationEvent.md"},{"name":"StreamMessageOptions","path":"interfaces/StreamMessageOptions.md"},{"name":"StreamMetadata","path":"interfaces/StreamMetadata.md"},{"name":"StreamrClientConfig","path":"interfaces/StreamrClientConfig.md"},{"name":"StreamrClientEvents","path":"interfaces/StreamrClientEvents.md"},{"name":"StreamrNodeOpts","path":"interfaces/StreamrNodeOpts.md"},{"name":"SubscriptionEvents","path":"interfaces/SubscriptionEvents.md"},{"name":"TrackerRegistryRecord","path":"interfaces/TrackerRegistryRecord.md"},{"name":"UpdateEncryptionKeyOptions","path":"interfaces/UpdateEncryptionKeyOptions.md"},{"name":"UserPermissionAssignment","path":"interfaces/UserPermissionAssignment.md"},{"name":"UserPermissionQuery","path":"interfaces/UserPermissionQuery.md"},{"name":"layer0Config","path":"interfaces/layer0Config.md"}]} category="interface" />

## Enums

<FeaturedLinks links={[{"name":"ContentType","path":"enums/ContentType.md"},{"name":"EncryptionType","path":"enums/EncryptionType.md"},{"name":"ProxyDirection","path":"enums/ProxyDirection.md"},{"name":"StreamMessageType","path":"enums/StreamMessageType.md"},{"name":"StreamPermission","path":"enums/StreamPermission.md"}]} category="enum" />

## Type Aliases

### BrandedString

• **BrandedString**<`T`\>: `string` & { `__brand`: `T`  }

#### Type parameters

| Name |
| :------ |
| `T` |

___

### ConnectionInfo

• **ConnectionInfo**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `allowGzip?` | `boolean` |
| `allowInsecureAuthentication?` | `boolean` |
| `errorPassThrough?` | `boolean` |
| `fetchOptions?` | `Record`<`string`, `string`\> |
| `headers?` | { `[key: string]`: `string` \| `number`;  } |
| `password?` | `string` |
| `skipFetchSetup?` | `boolean` |
| `throttleCallback?` | (`attempt`: `number`, `url`: `string`) => `Promise`<`boolean`\> |
| `throttleLimit?` | `number` |
| `throttleSlotInterval?` | `number` |
| `timeout?` | `number` |
| `url` | `string` |
| `user?` | `string` |

___

### EthereumAddress

• **EthereumAddress**: [`BrandedString`](index.md#brandedstring)<``"EthereumAddress"``\>

___

### ExternalProvider

• **ExternalProvider**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `host?` | `string` |
| `isMetaMask?` | `boolean` |
| `isStatus?` | `boolean` |
| `path?` | `string` |
| `request?` | (`request`: { `method`: `string` ; `params?`: `any`[]  }) => `Promise`<`any`\> |
| `send?` | (`request`: { `method`: `string` ; `params?`: `any`[]  }, `callback`: (`error`: `any`, `response`: `any`) => `void`) => `void` |
| `sendAsync?` | (`request`: { `method`: `string` ; `params?`: `any`[]  }, `callback`: (`error`: `any`, `response`: `any`) => `void`) => `void` |

___

### LogLevel

• **LogLevel**: ``"silent"`` \| ``"fatal"`` \| ``"error"`` \| ``"warn"`` \| ``"info"`` \| ``"debug"`` \| ``"trace"``

___

### MessageListener

• **MessageListener**: (`content`: `unknown`, `metadata`: [`MessageMetadata`](index.md#messagemetadata)) => `unknown` \| `Promise`<`unknown`\>

#### Type declaration

▸ (`content`, `metadata`): `unknown` \| `Promise`<`unknown`\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `content` | `unknown` |
| `metadata` | [`MessageMetadata`](index.md#messagemetadata) |

##### Returns

`unknown` \| `Promise`<`unknown`\>

___

### MessageMetadata

• **MessageMetadata**: `Omit`<[`Message`](interfaces/Message.md), ``"content"``\>

___

### MetricsDefinition

• **MetricsDefinition**: `Record`<`string`, [`Metric`](classes/Metric.md)\>

___

### MetricsReport

• **MetricsReport**: { `period`: { `end`: `number` ; `start`: `number`  }  } & `Record`<`string`, `any`\>

___

### PermissionAssignment

• **PermissionAssignment**: [`UserPermissionAssignment`](interfaces/UserPermissionAssignment.md) \| [`PublicPermissionAssignment`](interfaces/PublicPermissionAssignment.md)

___

### PermissionQuery

• **PermissionQuery**: [`UserPermissionQuery`](interfaces/UserPermissionQuery.md) \| [`PublicPermissionQuery`](interfaces/PublicPermissionQuery.md)

___

### ResendOptions

• **ResendOptions**: [`ResendLastOptions`](interfaces/ResendLastOptions.md) \| [`ResendFromOptions`](interfaces/ResendFromOptions.md) \| [`ResendRangeOptions`](interfaces/ResendRangeOptions.md)

The supported resend types.

___

### StreamDefinition

• **StreamDefinition**: `string` \| { `id`: `string` ; `partition?`: `number`  } \| { `partition?`: `number` ; `stream`: `string`  } \| { `partition?`: `number` ; `streamId`: `string`  }

___

### StreamID

• **StreamID**: [`BrandedString`](index.md#brandedstring)<``"StreamID"``\>

___

### StreamMessageAESEncrypted

• **StreamMessageAESEncrypted**<`T`\>: [`StreamMessage`](classes/StreamMessage.md)<`T`\> & { `encryptionType`: [`AES`](enums/EncryptionType.md#aes) ; `groupKeyId`: `string` ; `parsedContent`: `never`  }

Encrypted StreamMessage.

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | `unknown` |

___

### StreamPartID

• **StreamPartID**: [`BrandedString`](index.md#brandedstring)<``"StreamPartID"``\>

___

### SubscribeOptions

• **SubscribeOptions**: [`StreamDefinition`](index.md#streamdefinition) & [`ExtraSubscribeOptions`](interfaces/ExtraSubscribeOptions.md)

## Variables

### CONFIG\_TEST

• `Const` **CONFIG\_TEST**: [`StreamrClientConfig`](interfaces/StreamrClientConfig.md)

Streamr client constructor options that work in the test environment

___

### PeerDescriptor

• **PeerDescriptor**: `PeerDescriptor$Type`

**`Generated`**

MessageType for protobuf message dht.PeerDescriptor

___

### STREAMR\_STORAGE\_NODE\_GERMANY

• `Const` **STREAMR\_STORAGE\_NODE\_GERMANY**: ``"0x31546eEA76F2B2b3C5cC06B1c93601dc35c9D916"``

___

### VALID\_FIELD\_TYPES

• `Const` **VALID\_FIELD\_TYPES**: readonly [``"number"``, ``"string"``, ``"boolean"``, ``"list"``, ``"map"``]

## Functions

### formStorageNodeAssignmentStreamId

▸ **formStorageNodeAssignmentStreamId**(`clusterAddress`): [`StreamID`](index.md#streamid)

#### Parameters

| Name | Type |
| :------ | :------ |
| `clusterAddress` | `string` |

#### Returns

[`StreamID`](index.md#streamid)