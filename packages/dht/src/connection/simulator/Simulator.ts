/* eslint-disable @typescript-eslint/parameter-properties */
import EventEmitter from 'eventemitter3'
import { PeerIDKey } from '../../helpers/PeerID'
import { PeerDescriptor } from '../../proto/packages/dht/protos/DhtRpc'
import { ConnectionSourceEvents } from '../IConnectionSource'
import { SimulatorConnector } from './SimulatorConnector'
import { SimulatorConnection } from './SimulatorConnection'
import { ConnectionID } from '../IConnection'
import { Logger } from '@streamr/utils'
import { getRegionDelayMatrix } from './pings'
import { keyFromPeerDescriptor } from '../../helpers/peerIdFromPeerDescriptor'
import Heap from 'heap'
import { debugVars } from '../../helpers/debugHelpers'
import * as sinon from 'sinon'

// TODO take this from @streamr/test-utils (we can't access devDependencies as Simulator
// is currently in "src" directory instead of "test" directory)
// eslint-disable-next-line no-underscore-dangle
declare let _streamr_electron_test: any
export function isRunningInElectron(): boolean {
    // eslint-disable-next-line no-underscore-dangle
    return typeof _streamr_electron_test !== 'undefined'
}

const logger = new Logger(module)

export enum LatencyType { NONE = 'NONE', RANDOM = 'RANDOM', REAL = 'REAL', FIXED = 'FIXED' }

// One-way 'pipe' of messages

class Association {
    public sourceConnection: SimulatorConnection
    public destinationConnection?: SimulatorConnection
    private lastOperationAt: number = 0
    private closing = false

    constructor(sourceConnection: SimulatorConnection,
        destinationConnection?: SimulatorConnection,
        public connectedCallback?: (error?: string) => void
    ) {
        this.sourceConnection = sourceConnection
        this.destinationConnection = destinationConnection
    }

    public setDestinationConnection(connection: SimulatorConnection) {
        this.destinationConnection = connection
    }

    public getLastOperationAt(): number {
        return this.lastOperationAt
    }

    public setLastOperationAt(executionTime: number): void {
        this.lastOperationAt = executionTime
    }

    public setClosing(): void {
        this.closing = true
    }

    public isClosing(): boolean {
        return this.closing
    }
}

class SimulatorOperation {
    private static objectCounter = 0
    public objectId = 0

    constructor(
        public executionTime: number,
        public association: Association
    ) {
        this.objectId = SimulatorOperation.objectCounter
        SimulatorOperation.objectCounter++
    }
}

class ConnectOperation extends SimulatorOperation {
    constructor(
        executionTime: number,
        association: Association,
        public sourceConnection: SimulatorConnection,
        public targetDescriptor: PeerDescriptor) {

        super(executionTime, association)
    }
}

class SendOperation extends SimulatorOperation {
    constructor(
        executionTime: number,
        association: Association,
        public data: Uint8Array
    ) {
        super(executionTime, association)
    }
}

class CloseOperation extends SimulatorOperation {
}

export class Simulator extends EventEmitter<ConnectionSourceEvents> {
    private stopped = false
    private connectors: Map<PeerIDKey, SimulatorConnector> = new Map()
    private latencyTable?: Array<Array<number>>
    private associations: Map<ConnectionID, Association> = new Map()

    private latencyType: LatencyType
    private fixedLatency?: number

    private loopCounter = 0
    private MAX_LOOPS = 1000

    private operationQueue: Heap<SimulatorOperation> = new Heap<SimulatorOperation>((a: SimulatorOperation, b: SimulatorOperation) => {
        if ((a.executionTime - b.executionTime) === 0) {
            return (a.objectId - b.objectId)
        } else {
            return (a.executionTime - b.executionTime)
        }
    })

    private simulatorTimeout?: NodeJS.Timeout
    private static clock: sinon.SinonFakeTimers | undefined

    static useFakeTimers(on = true): void {
        if (!isRunningInElectron()) {  // never use fake timers in browser environment
            if (on) {
                if (!Simulator.clock) {
                    Simulator.clock = sinon.useFakeTimers()
                }
            } else {
                if (Simulator.clock) {
                    Simulator.clock.restore()
                    Simulator.clock = undefined
                }
            }
        }
    }

    constructor(latencyType: LatencyType = LatencyType.NONE, fixedLatency?: number) {
        super()

        this.latencyType = latencyType
        this.fixedLatency = fixedLatency

        if (this.latencyType === LatencyType.REAL) {
            this.latencyTable = getRegionDelayMatrix()
        }

        if (this.latencyType === LatencyType.FIXED && !this.fixedLatency) {
            throw new Error('LatencyType.FIXED requires the desired latency to be given as second parameter')
        }

        this.generateExecutionTime = this.generateExecutionTime.bind(this)
        this.getLatency = this.getLatency.bind(this)
        this.executeCloseOperation = this.executeCloseOperation.bind(this)
        this.executeConnectOperation = this.executeConnectOperation.bind(this)
        this.executeSendOperation = this.executeSendOperation.bind(this)
        this.executeQueuedOperations = this.executeQueuedOperations.bind(this)
        this.accept = this.accept.bind(this)
        this.send = this.send.bind(this)
        this.close = this.close.bind(this)
        this.scheduleNextTimeout = this.scheduleNextTimeout.bind(this)
        this.scheduleOperation = this.scheduleOperation.bind(this)
    }

    private generateExecutionTime(association: Association, sourceRegion: number | undefined, targetRegion: number | undefined): number {
        let executionTime = Date.now() + this.getLatency(sourceRegion, targetRegion)
        if (association.getLastOperationAt() > executionTime) {
            executionTime = association.getLastOperationAt()
        }

        return executionTime
    }

    private getLatency(sourceRegion: number | undefined, targetRegion: number | undefined): number {
        let latency: number = 0

        if (this.latencyType === LatencyType.FIXED) {
            latency = this.fixedLatency!
        }

        if (this.latencyType === LatencyType.REAL) {

            if (sourceRegion === undefined || targetRegion === undefined || sourceRegion > 15 || targetRegion > 15) {
                logger.error('invalid region index given to Simulator')
                throw ('invalid region index given to Simulator')
            }

            latency = this.latencyTable![sourceRegion][targetRegion]
        }
        if (this.latencyType === LatencyType.RANDOM) {
            latency = Math.random() * (250 - 5) + 5
        }

        return latency
    }

    public accept(sourceConnection: SimulatorConnection, targetConnection: SimulatorConnection): void {

        const sourceAssociation = this.associations.get(sourceConnection.connectionId)

        if (!sourceAssociation) {
            logger.error('source association not found in accept()')
            return
        }
        sourceAssociation.setDestinationConnection(targetConnection)

        const targetAssociation = new Association(targetConnection, sourceConnection)
        this.associations.set(targetConnection.connectionId, targetAssociation)

        sourceAssociation.connectedCallback!()
    }

    public addConnector(connector: SimulatorConnector): void {
        this.connectors.set(keyFromPeerDescriptor(connector.getPeerDescriptor()), connector)
    }

    private executeConnectOperation(operation: ConnectOperation): void {
        const target = this.connectors.get(keyFromPeerDescriptor(operation.targetDescriptor))

        if (!target) {
            logger.error('Target connector not found when executing connect operation')
            return operation.association.connectedCallback!('Target connector not found')
        }

        target.handleIncomingConnection(operation.sourceConnection)
    }

    private executeCloseOperation(operation: CloseOperation): void {

        if (this.stopped) {
            return
        }

        const target = operation.association.destinationConnection

        let counterAssociation: Association | undefined

        if (target) {
            counterAssociation = this.associations.get(target.connectionId)
        }

        if (!target || !counterAssociation) {
            this.associations.delete(operation.association.sourceConnection.connectionId)

        } else if (!counterAssociation.isClosing()) {
            target.handleIncomingDisconnection()
            this.close(target)
        } else {
            // this is the 'ack' of the CloseOperation to the original closer
            this.associations.delete(target.connectionId)
            this.associations.delete(operation.association.sourceConnection.connectionId)
        }
    }

    private executeSendOperation(operation: SendOperation): void {

        if (this.stopped) {
            return
        }

        const target = operation.association.destinationConnection
        target!.handleIncomingData(operation.data)

    }

    private executeQueuedOperations(): void {
        const currentTime = Date.now()
        while (this.operationQueue.size() > 0
            && this.operationQueue.peek()!.executionTime <= currentTime) {
            const operation = this.operationQueue.pop()

            if (operation instanceof ConnectOperation) {
                this.executeConnectOperation(operation)
            } else if (operation instanceof CloseOperation) {
                this.executeCloseOperation(operation)
            } else if (operation instanceof SendOperation) {
                this.executeSendOperation(operation)
            } else {
                logger.error('Unknown SimulatorOperation')
            }

            this.loopCounter++
            if (this.loopCounter >= this.MAX_LOOPS) {
                this.loopCounter = 0
                setTimeout(() => this.executeQueuedOperations(), 0)
                return
            }
        }

        this.scheduleNextTimeout()
    }

    private scheduleNextTimeout(): void {
        if (this.simulatorTimeout) {
            clearTimeout(this.simulatorTimeout)
            this.simulatorTimeout = undefined
        }

        const currentTime = Date.now()

        const firstOperation = this.operationQueue.peek()

        if (!firstOperation) {
            return
        }

        const firstOperationTime = firstOperation.executionTime
        const timeDifference = firstOperationTime - currentTime

        this.simulatorTimeout = setTimeout(this.executeQueuedOperations, timeDifference)

        if (Simulator.clock) {
            Simulator.clock.runAllAsync()
        }
    }

    private scheduleOperation(operation: SimulatorOperation) {
        this.operationQueue.push(operation)
        this.scheduleNextTimeout()
    }

    public connect(sourceConnection: SimulatorConnection, targetDescriptor: PeerDescriptor, connectedCallback: (error?: string) => void): void {

        if (this.stopped) {
            logger.error('connect() called on a stopped simulator ' + (new Error().stack))
            return
        }
        debugVars['simulatorHeapSize'] = this.operationQueue.size()

        const association = new Association(sourceConnection, undefined, connectedCallback)
        this.associations.set(sourceConnection.connectionId, association)

        const executionTime = this.generateExecutionTime(association, sourceConnection.localPeerDescriptor.region, targetDescriptor.region)
        association.setLastOperationAt(executionTime)

        const operation = new ConnectOperation(executionTime, association,
            sourceConnection, targetDescriptor)

        this.scheduleOperation(operation)
    }

    public close(sourceConnection: SimulatorConnection): void {

        if (this.stopped) {
            return
        }

        const association = this.associations.get(sourceConnection.connectionId)
        if (!association) {
            return
        }

        association.setClosing()

        const executionTime = this.generateExecutionTime(association,
            sourceConnection.localPeerDescriptor.region,
            sourceConnection.getPeerDescriptor()?.region)
        association.setLastOperationAt(executionTime)

        const operation = new CloseOperation(executionTime, association)

        this.scheduleOperation(operation)
    }

    public send(sourceConnection: SimulatorConnection, data: Uint8Array): void {

        if (this.stopped) {
            return
        }

        const association = this.associations.get(sourceConnection.connectionId)
        if (!association) {
            return
        }

        if (association.isClosing()) {
            logger.trace('Tried to call send() on a closing association')
            return
        }

        const executionTime = this.generateExecutionTime(association,
            sourceConnection.localPeerDescriptor.region,
            association.destinationConnection!.localPeerDescriptor.region)

        association.setLastOperationAt(executionTime)

        const operation = new SendOperation(executionTime, association, data)

        this.scheduleOperation(operation)
    }

    public stop(): void {
        this.stopped = true
        logger.info(this.associations.size + ' associations in the beginning of stop()')

        if (this.simulatorTimeout) {
            clearTimeout(this.simulatorTimeout)
        }
    }

    public getAssociationsAsUndirectedGraph(): Map<PeerIDKey, Array<PeerIDKey>> {
        const ret = new Map<PeerIDKey, Array<PeerIDKey>>()
        this.associations.forEach((association) => {
            if (association.destinationConnection) {
                let sourceKey = keyFromPeerDescriptor(association.sourceConnection.getPeerDescriptor()!)
                let targetKey = keyFromPeerDescriptor(association.destinationConnection.getPeerDescriptor()!)
                // order source and target keys so that the key with the lower value is the source
                if (sourceKey > targetKey) {
                    const tmp = sourceKey
                    sourceKey = targetKey
                    targetKey = tmp
                }

                if (!ret.has(sourceKey)) {
                    ret.set(sourceKey, [targetKey])
                } else {
                    if (!ret.get(sourceKey)!.includes(targetKey)) {
                        ret.get(sourceKey)!.push(targetKey)
                    }
                }
            }
        })
        return ret
    }

    public getNumberOdConnectedComponents(): number {
        const graph = this.getAssociationsAsUndirectedGraph()
        const visited: Map<string, boolean> = new Map()
        let count = 0

        for (const node of graph.keys()) {
            if (!visited.get(node)) {
                depthFirstSearch(node)
                count++
            }
        }

        function depthFirstSearch(node: PeerIDKey) {
            visited.set(node, true)
            for (const neighbor of graph.get(node)!) {
                if (!visited.get(neighbor)) {
                    depthFirstSearch(neighbor)
                }
            }
        }
        
        return count
    }
}