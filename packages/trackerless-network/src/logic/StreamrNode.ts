import { RandomGraphNode, Event as RandomGraphEvent } from './RandomGraphNode'
import { PeerDescriptor, ConnectionLocker, DhtNode, ITransport } from '@streamr/dht'
import { StreamMessage } from '../proto/packages/trackerless-network/protos/NetworkRpc'
import { EventEmitter } from 'events'
import { Logger } from '@streamr/utils'

interface StreamObject {
    layer1: DhtNode
    layer2: RandomGraphNode
}

export enum Event {
    NEW_MESSAGE = 'unseen-message'
}

export interface StreamrNode {
    on(event: Event.NEW_MESSAGE, listener: (msg: StreamMessage) => void): this
}

const logger = new Logger(module)

export class StreamrNode extends EventEmitter {
    private readonly streams: Map<string, StreamObject>
    private layer0: DhtNode | null = null
    private started = false
    private stopped = false
    private P2PTransport: ITransport | null = null
    private connectionLocker: ConnectionLocker | null = null
    constructor() {
        super()
        this.streams = new Map()
    }

    async start(startedAndJoinedLayer0: DhtNode, transport: ITransport, connectionLocker: ConnectionLocker): Promise<void> {
        if (this.started || this.stopped) {
            return
        }
        logger.info(`Starting new StreamrNode with id ${startedAndJoinedLayer0.getPeerDescriptor().peerId}`)
        this.started = true
        this.layer0 = startedAndJoinedLayer0
        this.P2PTransport = transport
        this.connectionLocker = connectionLocker
    }

    destroy(): void {
        if (!this.started) {
            return
        }
        this.stopped = true
        this.layer0!.stop()
        this.streams.forEach((stream) => {
            stream.layer2.stop()
            stream.layer1.stop()
        })
        this.streams.clear()
    }

    subscribeToStream(streamPartID: string, entryPointDescriptor: PeerDescriptor): void {
        if (this.streams.has(streamPartID)) {
            this.streams.get(streamPartID)!.layer2.on(
                RandomGraphEvent.MESSAGE,
                (message: StreamMessage) =>
                    this.emit(Event.NEW_MESSAGE, message))
        } else {
            this.joinStream(streamPartID, entryPointDescriptor)
                .then(() => this.streams.get(streamPartID)?.layer2.on(
                    RandomGraphEvent.MESSAGE, (message: StreamMessage) => this.emit(Event.NEW_MESSAGE, message)
                ))
                .catch((err) => {
                    logger.warn(`Failed to subscribe to stream ${streamPartID} with error: ${err}`)
                    this.subscribeToStream(streamPartID, entryPointDescriptor)
                })
        }
    }

    publishToStream(streamPartID: string, entryPointDescriptor: PeerDescriptor, msg: StreamMessage): void {
        if (this.streams.has(streamPartID)) {
            this.streams.get(streamPartID)!.layer2.broadcast(msg)
        } else {
            this.joinStream(streamPartID, entryPointDescriptor)
                .then(() => this.streams.get(streamPartID)?.layer2.broadcast(msg))
                .catch((err) => {
                    logger.warn(`Failed to publish to stream ${streamPartID} with error: ${err}`)
                })
        }
    }

    unsubscribeFromStream(streamPartID: string): void {
        this.leaveStream(streamPartID)
    }

    leaveStream(streamPartID: string): void {
        const stream = this.streams.get(streamPartID)
        if (stream) {
            stream.layer2.stop()
            stream.layer1.stop()
        }
    }

    async joinStream(streamPartID: string, entryPoint: PeerDescriptor): Promise<void> {
        if (this.streams.has(streamPartID)) {
            return
        }
        logger.info(`Joining stream ${streamPartID}`)

        const layer1 = new DhtNode({
            transportLayer: this.layer0!,
            serviceId: 'layer1::' + streamPartID,
            peerDescriptor: this.layer0!.getPeerDescriptor(),
            routeMessageTimeout: 5000,
            entryPoints: [entryPoint],
            numberOfNodesPerKBucket: 4,
            rpcRequestTimeout: 15000,
            dhtJoinTimeout: 90000
        })
        const layer2 = new RandomGraphNode({
            randomGraphId: streamPartID,
            P2PTransport: this.P2PTransport!,
            layer1: layer1,
            connectionLocker: this.connectionLocker!,
            ownPeerDescriptor: this.layer0!.getPeerDescriptor()
        })
        this.streams.set(streamPartID, {
            layer1,
            layer2
        })

        await layer1.start()
        layer2.start()
        await layer1.joinDht(entryPoint)
    }

    getStream(streamPartId: string): StreamObject | undefined {
        return this.streams.get(streamPartId)
    }

    hasStream(streamPartId: string): boolean {
        return this.streams.has(streamPartId)
    }

    getPeerDescriptor(): PeerDescriptor {
        return this.layer0!.getPeerDescriptor()
    }
}