/* eslint-disable no-console */
import { getTestInterface } from '@streamr/test-utils'
import { Simulator } from '../../src/connection/simulator/Simulator'
import { DhtNode } from '../../src/dht/DhtNode'
import { PeerID } from '../../src/helpers/PeerID'
import { keyFromPeerDescriptor } from '../../src/helpers/peerIdFromPeerDescriptor'
import { NodeType, PeerDescriptor } from '../../src/proto/packages/dht/protos/DhtRpc'
import { createMockConnectionDhtNode } from '../utils/utils'
import { execSync } from 'child_process'
import fs from 'fs'

describe('Kademlia correctness', () => {
    let entryPoint: DhtNode
    let nodes: DhtNode[]
    let entrypointDescriptor: PeerDescriptor
    const simulator = new Simulator()
    const NUM_NODES = 1000

    const nodeIndicesById: Record<string, number> = {}

    if (!fs.existsSync('test/data/nodeids.json')) {
        console.log('gound truth data does not exist yet, generating..')
        execSync('npm run prepare-kademlia-simulation')
    }

    const dhtIds: Array<{ type: string, data: Array<number> }> = JSON.parse(fs.readFileSync('test/data/nodeids.json').toString())
    const groundTruth: Record<string, Array<{ name: string, distance: number, id: { type: string, data: Array<number> } }>>
        = JSON.parse(fs.readFileSync('test/data/orderedneighbors.json').toString())

    beforeEach(async () => {

        nodes = []
        const entryPointId = '0'
        entryPoint = await createMockConnectionDhtNode(entryPointId, simulator, Uint8Array.from(dhtIds[0].data), 8)
        nodes.push(entryPoint)
        nodeIndicesById[entryPoint.getNodeId().toKey()] = 0
        entrypointDescriptor = {
            kademliaId: entryPoint.getNodeId().value,
            type: NodeType.NODEJS
        }

        for (let i = 1; i < NUM_NODES; i++) {
            const nodeId = `${i}`

            const node = await createMockConnectionDhtNode(nodeId, simulator, Uint8Array.from(dhtIds[i].data))
            nodeIndicesById[node.getNodeId().toKey()] = i
            nodes.push(node)
        }
    })

    afterEach(async () => {
        await Promise.all([
            entryPoint.stop(),
            ...nodes.map(async (node) => await node.stop())
        ])
    })

    it('Can find correct neighbors', async () => {
        await entryPoint.joinDht([entrypointDescriptor])

        await Promise.allSettled(
            nodes.map((node) => node.joinDht([entrypointDescriptor]))
        )

        let minimumCorrectNeighbors = Number.MAX_SAFE_INTEGER
        let sumCorrectNeighbors = 0
        let sumKbucketSize = 1

        for (let i = nodes.length - 1; i >= 0; i--) {
            let groundTruthString = 'groundTruthNeighb: '
            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let j = 0; j < groundTruth[i + ''].length; j++) {
                groundTruthString += groundTruth[i + ''][j].name + ','
            }

            const kademliaNeighbors = nodes[i].getClosestContacts().map((p) => PeerID.fromValue(p.kademliaId))

            let kadString = 'kademliaNeighbors: '
            kademliaNeighbors.forEach((neighbor) => {
                kadString += nodeIndicesById[neighbor.toKey()] + ','
            })

            let correctNeighbors = 0
            try {
                for (let j = 0; j < groundTruth[i + ''].length; j++) {
                    if (groundTruth[i + ''][j].name != (nodeIndicesById[kademliaNeighbors[j].toKey()] + '')) {
                        break
                    }
                    correctNeighbors++
                }
            } catch (e) {
                console.error('Node ' + keyFromPeerDescriptor(nodes[i].getLocalPeerDescriptor()) + ' had only ' 
                    + kademliaNeighbors.length + ' kademlia neighbors')
            }
            if (correctNeighbors === 0) {
                console.log('No correct neighbors found for node ' + i)
                console.log(groundTruthString)
                console.log(kadString)
            }
            if (correctNeighbors < minimumCorrectNeighbors) {
                console.log('NEW MIN', i, correctNeighbors)
                minimumCorrectNeighbors = correctNeighbors
            }

            if (i > 0) {
                sumKbucketSize += getTestInterface(getTestInterface((nodes[i])).getPeerManager()).getKBucketSize()
                sumCorrectNeighbors += correctNeighbors
            }
        }

        const avgKbucketSize = sumKbucketSize / (NUM_NODES - 1)
        const avgCorrectNeighbors = sumCorrectNeighbors / (NUM_NODES - 1)

        console.log('----------- Simulation results ------------------')
        console.log('Minimum correct neighbors: ' + minimumCorrectNeighbors)
        console.log('Average correct neighbors: ' + avgCorrectNeighbors)
        console.log('Average Kbucket size: ' + avgKbucketSize)
    })
})
