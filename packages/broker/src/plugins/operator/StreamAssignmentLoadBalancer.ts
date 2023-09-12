import { OperatorFleetStateEvents } from './OperatorFleetState'
import { MaintainTopologyHelperEvents } from './MaintainTopologyHelper'
import { StreamID, StreamPartID } from '@streamr/protocol'
import { Logger } from '@streamr/utils'
import pLimit from 'p-limit'
import EventEmitter3 from 'eventemitter3'
import { ConsistentHashRing } from './ConsistentHashRing'
import { NodeID } from '@streamr/trackerless-network'

const logger = new Logger(module)

export interface StreamAssignmentLoadBalancerEvents {
    assigned(streamPartId: StreamPartID): void
    unassigned(streamPartId: StreamPartID): void
}

export class StreamAssignmentLoadBalancer extends EventEmitter3<StreamAssignmentLoadBalancerEvents> {
    private readonly allStreamParts = new Set<StreamPartID>()
    private readonly myStreamParts = new Set<StreamPartID>()
    private readonly concurrencyLimit = pLimit(1)
    private readonly consistentHashRing: ConsistentHashRing
    private readonly myNodeId: string
    private readonly getStreamParts: (streamId: StreamID) => Promise<StreamPartID[]>
    private readonly operatorFleetState: EventEmitter3<OperatorFleetStateEvents>
    private readonly maintainTopologyHelper: EventEmitter3<MaintainTopologyHelperEvents>

    constructor(
        myNodeId: NodeID,
        redundancyFactor: number,
        getStreamParts: (streamId: StreamID) => Promise<StreamPartID[]>,
        operatorFleetState: EventEmitter3<OperatorFleetStateEvents>,
        maintainTopologyHelper: EventEmitter3<MaintainTopologyHelperEvents>,
    ) {
        super()
        this.myNodeId = myNodeId
        this.getStreamParts = getStreamParts
        this.operatorFleetState = operatorFleetState
        this.maintainTopologyHelper = maintainTopologyHelper
        this.consistentHashRing = new ConsistentHashRing(redundancyFactor)
        this.consistentHashRing.add(myNodeId)
        this.operatorFleetState.on('added', this.nodeAdded)
        this.operatorFleetState.on('removed', this.nodeRemoved)
        this.maintainTopologyHelper.on('addStakedStreams', this.streamsAdded)
        this.maintainTopologyHelper.on('removeStakedStream', this.streamRemoved)
    }

    private nodeAdded = this.concurrencyLimiter(async (nodeId: NodeID): Promise<void> => {
        if (nodeId === this.myNodeId) {
            return
        }
        this.consistentHashRing.add(nodeId)
        this.recalculateAssignments()
    })

    private nodeRemoved = this.concurrencyLimiter(async (nodeId: NodeID): Promise<void> => {
        if (nodeId === this.myNodeId) {
            return
        }
        this.consistentHashRing.remove(nodeId)
        this.recalculateAssignments()
    })

    private streamsAdded = this.concurrencyLimiter(async (streamIds: StreamID[]): Promise<void> => {
        const streamPartIds = (await Promise.all(streamIds.map(this.getStreamPartIds))).flat()
        for (const streamPartId of streamPartIds) {
            this.allStreamParts.add(streamPartId)
        }
        this.recalculateAssignments() // TODO: optimize; calculate efficiently by only considering added stream parts
    })

    private streamRemoved = this.concurrencyLimiter(async (streamId: StreamID): Promise<void> => {
        const streamPartIds = await this.getStreamPartIds(streamId)
        for (const streamPartId of streamPartIds) {
            this.allStreamParts.delete(streamPartId)
        }
        this.recalculateAssignments() // TODO: optimize; calculate efficiently by only considering removed stream parts
    })

    private recalculateAssignments(): void {
        for (const streamPartId of this.allStreamParts) {
            if (this.consistentHashRing.get(streamPartId).includes(this.myNodeId) && !this.myStreamParts.has(streamPartId)) {
                this.myStreamParts.add(streamPartId)
                this.emit('assigned', streamPartId)
            }
        }
        for (const streamPartId of this.myStreamParts) {
            if (!this.allStreamParts.has(streamPartId) || !this.consistentHashRing.get(streamPartId).includes(this.myNodeId)) {
                this.myStreamParts.delete(streamPartId)
                this.emit('unassigned', streamPartId)
            }
        }
    }

    private getStreamPartIds = async (streamId: StreamID): Promise<StreamPartID[]> => {
        try {
            return await this.getStreamParts(streamId)
        } catch (err) {
            logger.warn('Ignore non-existing stream', { streamId, reason: err?.message })
            return []
        }
    }

    private concurrencyLimiter<T>(
        fn: (t: T) => Promise<void>
    ): (t: T) => void {
        return (t) => {
            this.concurrencyLimit(() => fn(t)).catch((err) => {
                logger.warn('Encountered error while processing event', { err })
            })
        }
    }
}