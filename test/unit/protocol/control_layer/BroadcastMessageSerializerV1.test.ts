import assert from 'assert'

import { StreamMessage, BroadcastMessage, ControlMessage } from '../../../../src/index'
import { PLACEHOLDER_REQUEST_ID_PROTOCOL_V1 } from '../../../../src/protocol/control_layer/ControlMessage'

const streamMessage = StreamMessage.deserialize([30, ['streamId', 0, 1529549961116, 0, 'address', 'msg-chain-id'],
    [1529549961000, 0], StreamMessage.MESSAGE_TYPES.MESSAGE, '{"valid": "json"}', StreamMessage.SIGNATURE_TYPES.ETH, 'signature'])

const VERSION = 1

// Message definitions
const message = new BroadcastMessage({
    version: VERSION,
    streamMessage,
    requestId: PLACEHOLDER_REQUEST_ID_PROTOCOL_V1
})
const serializedMessage = JSON.stringify([VERSION, ControlMessage.TYPES.BroadcastMessage, JSON.parse(streamMessage.serialize(30))])

describe('BroadcastMessageSerializerV1', () => {
    describe('deserialize', () => {
        it('correctly parses messages', () => {
            assert.deepStrictEqual(ControlMessage.deserialize(serializedMessage), message)
        })
    })
    describe('serialize', () => {
        it('correctly serializes messages', () => {
            assert.deepStrictEqual(message.serialize(VERSION, 30), serializedMessage)
        })
    })
})
