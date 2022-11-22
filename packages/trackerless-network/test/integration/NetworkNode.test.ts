import { NetworkNode } from '../../src/NetworkNode'
import { NodeType, PeerDescriptor, Simulator, SimulatorTransport } from '@streamr/dht'
import {
    MessageID,
    MessageRef,
    StreamMessage,
    StreamMessageType,
    StreamPartIDUtils,
    toStreamID
} from '@streamr/protocol'
import { EthereumAddress, waitForCondition } from '@streamr/utils'

describe('NetworkNode', () => {

    let transport1: SimulatorTransport
    let transport2: SimulatorTransport

    let node1: NetworkNode
    let node2: NetworkNode

    const pd1: PeerDescriptor = {
        kademliaId: new Uint8Array([1, 2, 3]),
        type: NodeType.NODEJS
    }

    const pd2: PeerDescriptor = {
        kademliaId: new Uint8Array([1, 1, 1]),
        type: NodeType.NODEJS
    }

    const STREAM_ID = StreamPartIDUtils.parse('test#0')

    beforeEach(async () => {
        const simulator = new Simulator()
        transport1 = new SimulatorTransport(pd1, simulator)
        transport2 = new SimulatorTransport(pd2, simulator)

        node1 = new NetworkNode({
            entryPoints: [pd1],
            peerDescriptor: pd1,
            transportLayer: transport1
        })
        node2 = new NetworkNode({
            entryPoints: [pd1],
            peerDescriptor: pd2,
            transportLayer: transport2
        })

        await node1.start()
        await node2.start()
    })

    afterEach(async () => {
        await Promise.all([
            node1.stop(),
            node2.stop()
        ])
    })

    it('wait for join + publish and subscribe', async () => {
        const streamMessage = new StreamMessage({
            messageId: new MessageID(
                toStreamID('test'),
                0,
                666,
                0,
                'peer2' as EthereumAddress,
                'msgChainId'
            ),
            prevMsgRef: new MessageRef(665, 0),
            content: {
                hello: 'world'
            },
            messageType: StreamMessageType.MESSAGE,
            signature: 'signature',
        })

        let msgCount = 0
        await node1.subscribeAndWaitForJoin(STREAM_ID, pd1)

        node1.addMessageListener((msg) => {
            expect(msg.messageId.timestamp).toEqual(666)
            expect(msg.getSequenceNumber()).toEqual(0)
            msgCount += 1
        })

        await node2.waitForJoinAndPublish(streamMessage, pd1)
        await waitForCondition(() => msgCount === 1)
    })

})