import 'reflect-metadata'
import { v4 as uuid } from 'uuid'
import {
    KeyExchangeStreamIDUtils,
    StreamMessage,
    StreamPartID,
    StreamPartIDUtils,
} from 'streamr-client-protocol'
import { GroupKey } from '../../src/encryption/GroupKey'
import { Wallet } from 'ethers'
import { RSAKeyPair } from '../../src/encryption/RSAKeyPair'
import { StreamPermission } from '../../src/permission'
import { 
    createMockMessage,
    createRelativeTestStreamId,
    getGroupKeyStore,
    startPublisherKeyExchangeSubscription
} from '../test-utils/utils'
import { getGroupKeysFromStreamMessage } from '../../src/encryption/SubscriberKeyExchange'
import { FakeEnvironment } from '../test-utils/fake/FakeEnvironment'
import { FakeNetworkNode } from '../test-utils/fake/FakeNetworkNode'
import { fastWallet } from 'streamr-test-utils'
import { StreamrClient } from '../../src/StreamrClient'

describe('PublisherKeyExchange', () => {

    let publisherWallet: Wallet
    let publisherClient: StreamrClient
    let subscriberWallet: Wallet
    let subscriberRSAKeyPair: RSAKeyPair
    let subscriberNode: FakeNetworkNode
    let streamPartId: StreamPartID
    let environment: FakeEnvironment

    const createStream = async () => {
        const stream = await publisherClient.createStream(createRelativeTestStreamId(module))
        await publisherClient.grantPermissions(stream.id, {
            permissions: [StreamPermission.SUBSCRIBE],
            user: subscriberWallet.address
        })
        return stream
    }

    const createGroupKeyRequest = (
        groupKeyId: string,
        publisher = subscriberWallet,
        rsaPublicKey = subscriberRSAKeyPair.getPublicKey()
    ): StreamMessage => {
        return createMockMessage({
            streamPartId: KeyExchangeStreamIDUtils.formStreamPartID(publisherWallet.address),
            publisher,
            content: JSON.stringify([
                uuid(),
                StreamPartIDUtils.getStreamID(streamPartId),
                rsaPublicKey,
                [groupKeyId]
            ]),
            messageType: StreamMessage.MESSAGE_TYPES.GROUP_KEY_REQUEST,
            encryptionType: StreamMessage.ENCRYPTION_TYPES.NONE,
            contentType: StreamMessage.CONTENT_TYPES.JSON,
        })
    }

    const testSuccessResponse = async (actualResponse: StreamMessage, expectedGroupKeys: GroupKey[]): Promise<void> => {
        const subscriberKeyExchangeStreamPartId = KeyExchangeStreamIDUtils.formStreamPartID(subscriberWallet.address)
        expect(actualResponse).toMatchObject({
            messageId: {
                streamId: StreamPartIDUtils.getStreamID(subscriberKeyExchangeStreamPartId),
                streamPartition: StreamPartIDUtils.getStreamPartition(subscriberKeyExchangeStreamPartId),
                publisherId: publisherWallet.address.toLowerCase(),
            },
            messageType: StreamMessage.MESSAGE_TYPES.GROUP_KEY_RESPONSE,
            contentType: StreamMessage.CONTENT_TYPES.JSON,
            encryptionType: StreamMessage.ENCRYPTION_TYPES.RSA,
            signatureType: StreamMessage.SIGNATURE_TYPES.ETH,
            signature: expect.any(String)
        })
        const actualKeys = await getGroupKeysFromStreamMessage(actualResponse, subscriberRSAKeyPair.getPrivateKey())
        expect(actualKeys).toEqual(expectedGroupKeys)
    }

    beforeEach(async () => {
        publisherWallet = fastWallet()
        subscriberWallet = fastWallet()
        subscriberRSAKeyPair = await RSAKeyPair.create()
        environment = new FakeEnvironment()
        publisherClient = environment.createClient({
            auth: {
                privateKey: publisherWallet.privateKey
            }
        })
        const stream = await createStream()
        streamPartId = stream.getStreamParts()[0]
        subscriberNode = environment.startNode(subscriberWallet.address)
        await startPublisherKeyExchangeSubscription(publisherClient)
    })

    afterEach(async () => {
        await environment.destroy()
    })

    describe('responds to a group key request', () => {

        /*
         * A publisher node starts a subscription to receive group key requests
         * - tests that a correct kind of response message is sent to a subscriber node
         */
        it('happy path', async () => {
            const key = GroupKey.generate()
            await getGroupKeyStore(StreamPartIDUtils.getStreamID(streamPartId), publisherWallet.address).add(key)

            const request = createGroupKeyRequest(key.id)
            subscriberNode.publish(request)

            const response = await environment.getNetwork().waitForSentMessage({
                messageType: StreamMessage.MESSAGE_TYPES.GROUP_KEY_RESPONSE
            })
            await testSuccessResponse(response!, [key])
        })
    })
})