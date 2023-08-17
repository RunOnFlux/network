import { PeerDescriptor, NodeType, PeerID } from '@streamr/dht'
import { NetworkNode } from '../../src/NetworkNode'
import { MessageID, MessageRef, StreamMessage, StreamMessageType, toStreamID, toStreamPartID } from '@streamr/protocol'
import { EthereumAddress } from 'streamr-client'
import { waitForCondition } from '@streamr/utils'

describe('inspect', () => {

    const publisherDescriptor: PeerDescriptor = {
        kademliaId: PeerID.fromString('publisher').value,
        type: NodeType.NODEJS,
        websocket: {
            ip: 'localhost',
            port: 15478
        }
    }

    const inspectedDescriptor: PeerDescriptor = {
        kademliaId: PeerID.fromString('inspected').value,
        type: NodeType.NODEJS,
        websocket: {
            ip: 'localhost',
            port: 15479
        }
    }

    const inspectorDescriptor: PeerDescriptor = {
        kademliaId: PeerID.fromString('inspector').value,
        type: NodeType.NODEJS,
        websocket: {
            ip: 'localhost',
            port: 15480
        }
    }

    const streamPartId = toStreamPartID(toStreamID('stream'), 0)

    let publisherNode: NetworkNode

    let inspectedNode: NetworkNode

    let inspectorNode: NetworkNode

    const message = new StreamMessage({ 
        messageId: new MessageID(
            toStreamID('stream'),
            0,
            666,
            0,
            'peer' as EthereumAddress,
            'msgChainId'
        ),
        prevMsgRef: new MessageRef(665, 0),
        content: {
            hello: 'world'
        },
        messageType: StreamMessageType.MESSAGE,
        signature: 'signature',
    })
    
    beforeEach(async () => {
        publisherNode = new NetworkNode({
            layer0: {
                entryPoints: [publisherDescriptor],
                peerDescriptor: publisherDescriptor
            },
            networkNode: {}
        })

        inspectedNode = new NetworkNode({
            layer0: {
                entryPoints: [publisherDescriptor],
                peerDescriptor: inspectedDescriptor
            },
            networkNode: {}
        })

        inspectorNode = new NetworkNode({
            layer0: {
                entryPoints: [publisherDescriptor],
                peerDescriptor: inspectorDescriptor
            },
            networkNode: {}
        })

        await publisherNode.start()
        await inspectedNode.start()
        await inspectorNode.start()    

        await Promise.all([
            publisherNode.stack.getStreamrNode()!.joinStream(streamPartId),
            inspectedNode.stack.getStreamrNode()!.joinStream(streamPartId),
            inspectorNode.stack.getStreamrNode()!.joinStream(streamPartId)
        ])

        await waitForCondition(() => 
            publisherNode.getNeighbors().length === 2 
            && inspectedNode.getNeighbors().length === 2 
            && inspectorNode.getNeighbors().length === 2
        )
    }, 30000)

    afterEach(async () => {
        await Promise.all([
            publisherNode.stop(),
            inspectedNode.stop(),
            inspectorNode.stop()
        ])
    })

    it('should inspect succesfully', async () => {
        setTimeout(async () => {
            await publisherNode.publish(message)
        }, 250)
        const success = await inspectorNode.inspect(inspectedDescriptor, streamPartId)
        expect(success).toBe(true)
    })

})