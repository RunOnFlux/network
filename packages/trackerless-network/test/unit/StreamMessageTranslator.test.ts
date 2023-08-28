import { createStreamMessage } from '../utils/utils'
import { StreamMessageType } from '../../src/proto/packages/trackerless-network/protos/NetworkRpc'
import { StreamMessageTranslator } from '../../src/logic/protocol-integration/stream-message/StreamMessageTranslator'
import {
    EncryptionType,
    MessageID,
    StreamID,
    StreamMessage as OldStreamMessage,
    StreamMessageType as OldStreamMessageType
} from '@streamr/protocol'
import { binaryToHex, binaryToUtf8, hexToBinary, areEqualBinaries } from '@streamr/utils'

describe('StreamMessageTranslator', () => {

    const signature = hexToBinary('0x1234')
    const publisherId = hexToBinary('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    const protobufMsg = createStreamMessage(
        JSON.stringify({ hello: 'WORLD' }),
        'TEST',
        publisherId
    )
    const messageId = new MessageID(
        'TEST' as StreamID,
        0,
        Date.now(),
        0,
        publisherId,
        'test',
    )
    const oldProtocolMsg = new OldStreamMessage({
        messageId,
        prevMsgRef: null,
        content: { hello: 'WORLD' },
        messageType: OldStreamMessageType.MESSAGE,
        encryptionType: EncryptionType.NONE,
        signature,
    })

    it('translates old protocol to protobuf', () => {
        const translated = StreamMessageTranslator.toProtobuf(oldProtocolMsg)
        expect(translated.messageId!.timestamp).toBeGreaterThanOrEqual(0)
        expect(translated.messageId!.sequenceNumber).toEqual(0)
        expect(translated.messageId!.streamId).toEqual('TEST')
        expect(translated.messageId!.streamPartition).toEqual(0)
        expect(areEqualBinaries(translated.messageId!.publisherId, publisherId))
        expect(translated.previousMessageRef).toEqual(undefined)
        expect(translated.messageType).toEqual(StreamMessageType.MESSAGE)
        expect(translated.groupKeyId).toEqual(undefined)
        expect(areEqualBinaries(translated.signature, signature)).toEqual(true)
        expect(JSON.parse(binaryToUtf8(translated.content))).toEqual({ hello: 'WORLD' })

    })

    it('translates protobuf to old protocol', () => {
        const translated = StreamMessageTranslator.toClientProtocol(protobufMsg)
        expect(translated.messageId.timestamp).toBeGreaterThanOrEqual(0)
        expect(translated.messageId.sequenceNumber).toEqual(0)
        expect(translated.messageId.streamId).toEqual('TEST')
        expect(translated.messageId.streamPartition).toEqual(0)
        expect(areEqualBinaries(translated.getPublisherId(), publisherId))
        expect(translated.prevMsgRef).toEqual(null)
        expect(translated.messageType).toEqual(OldStreamMessageType.MESSAGE)
        expect(translated.contentType).toEqual(0)
        expect(translated.groupKeyId).toEqual(null)
        expect(areEqualBinaries(translated.signature, signature)).toEqual(true)
        expect(translated.getParsedContent()).toEqual({ hello: 'WORLD' })
    })
})
