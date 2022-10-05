import { DhtNode, Simulator, SimulatorTransport, PeerDescriptor, PeerID } from '@streamr/dht'
import { RandomGraphNode } from '../../src/logic/RandomGraphNode'
import { range } from 'lodash'
import { waitForCondition } from 'streamr-test-utils'
import { Logger } from '@streamr/utils'
import { mockConnectionLocker } from '../utils'

const logger = new Logger(module)

describe('RandomGraphNode-DhtNode', () => {
    const numOfNodes = 128
    let dhtNodes: DhtNode[]
    let dhtEntryPoint: DhtNode
    let entryPointRandomGraphNode: RandomGraphNode
    let graphNodes: RandomGraphNode[]

    const streamId = 'Stream1'
    const entrypointDescriptor: PeerDescriptor = {
        peerId: PeerID.fromString('entrypoint').value,
        type: 0
    }

    const peerDescriptors: PeerDescriptor[] = range(numOfNodes).map((i) => {
        return {
            peerId: PeerID.fromString(`peer${i}`).value,
            type: 0
        }
    })
    beforeEach(async () => {
        const simulator = new Simulator()
        const entrypointCm = new SimulatorTransport(entrypointDescriptor, simulator)

        const cms: SimulatorTransport[] = range(numOfNodes).map((i) =>
            new SimulatorTransport(peerDescriptors[i], simulator)
        )

        dhtEntryPoint = new DhtNode({
            transportLayer: entrypointCm,
            peerDescriptor: entrypointDescriptor,
            serviceId: streamId
        })

        dhtNodes = range(numOfNodes).map((i) => new DhtNode({
            transportLayer: cms[i],
            peerDescriptor: peerDescriptors[i],
            serviceId: streamId
        }))

        graphNodes = range(numOfNodes).map((i) => new RandomGraphNode({
            randomGraphId: streamId,
            layer1: dhtNodes[i],
            P2PTransport: cms[i],
            connectionLocker: mockConnectionLocker
        }))

        entryPointRandomGraphNode = new RandomGraphNode({
            randomGraphId: streamId,
            layer1: dhtEntryPoint,
            P2PTransport: entrypointCm,
            connectionLocker: mockConnectionLocker
        })

        await dhtEntryPoint.start()
        await dhtEntryPoint.joinDht(entrypointDescriptor)
        await Promise.all(dhtNodes.map((node) => node.start()))
    })

    afterEach(async () => {
        dhtEntryPoint.stop()
        entryPointRandomGraphNode.stop()
        await Promise.all(dhtNodes.map((node) => node.stop()))
        await Promise.all(graphNodes.map((node) => node.stop()))
    })

    it('happy path single peer', async () => {
        await dhtNodes[0].joinDht(entrypointDescriptor)
        entryPointRandomGraphNode.start()
        await graphNodes[0].start()

        await Promise.all([
            waitForCondition(() => graphNodes[0].getContactPoolIds().length === 1),
            waitForCondition(() => graphNodes[0].getTargetNeighborStringIds().length === 1)
        ])
        expect(graphNodes[0].getContactPoolIds().length).toEqual(1)
        expect(graphNodes[0].getTargetNeighborStringIds().length).toEqual(1)
    })

    it('happy path 4 peers', async () => {
        entryPointRandomGraphNode.start()
        range(4).map((i) => graphNodes[i].start())
        await Promise.all(range(4).map(async (i) => {
            await dhtNodes[i].joinDht(entrypointDescriptor)
        }))

        await waitForCondition(() => graphNodes[3].getTargetNeighborStringIds().length >= 4)

        range(4).map((i) => {
            expect(graphNodes[i].getContactPoolIds().length).toBeGreaterThanOrEqual(4)
            expect(graphNodes[i].getTargetNeighborStringIds().length).toBeGreaterThanOrEqual(4)
        })

        // Check bidirectionality
        const allNodes = graphNodes
        allNodes.push(entryPointRandomGraphNode)
        range(5).map((i) => {
            allNodes[i].getContactPoolIds().forEach((stringId) => {
                const neighbor = allNodes.find((peer) => {
                    return peer.getOwnStringId() === stringId
                })
                expect(neighbor!.getTargetNeighborStringIds().includes(allNodes[i].getOwnStringId())).toEqual(true)
            })
        })
    }, 10000)

    it('happy path 128 peers', async () => {
        range(numOfNodes).map((i) => graphNodes[i].start())
        await Promise.all(range(numOfNodes).map(async (i) => {
            await dhtNodes[i].joinDht(entrypointDescriptor)
        }))
        await Promise.all(graphNodes.map((node) =>
            Promise.all([
                waitForCondition(() => node.getContactPoolIds().length >= 8),
                waitForCondition(() => node.getTargetNeighborStringIds().length >= 3)
            ])
        ))
        const avg = graphNodes.reduce((acc, curr) => {
            return acc + curr.getTargetNeighborStringIds().length
        }, 0) / numOfNodes

        logger.info(`AVG Number of neighbors: ${avg}`)
    })
})