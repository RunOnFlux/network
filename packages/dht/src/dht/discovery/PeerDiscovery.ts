import { DiscoverySession } from './DiscoverySession'
import { DhtPeer } from '../DhtPeer'
import crypto from 'crypto'
import { isSamePeerDescriptor, keyFromPeerDescriptor } from '../../helpers/peerIdFromPeerDescriptor'
import { PeerDescriptor } from '../../proto/packages/dht/protos/DhtRpc'
import { Logger, scheduleAtInterval, setAbortableTimeout } from '@streamr/utils'
import { ConnectionManager } from '../../connection/ConnectionManager'
import { IPeerManager } from '../IPeerManager'

interface PeerDiscoveryConfig {
    ownPeerDescriptor: PeerDescriptor
    joinNoProgressLimit: number
    getClosestContactsLimit: number
    serviceId: string
    parallelism: number
    joinTimeout: number
    connectionManager?: ConnectionManager
    peerManager: IPeerManager
}

const logger = new Logger(module)

export class PeerDiscovery {
    private readonly config: PeerDiscoveryConfig
    private ongoingDiscoverySessions: Map<string, DiscoverySession> = new Map()
    private stopped = false
    private rejoinOngoing = false
    private joinCalled = false

    private rejoinTimeoutRef?: NodeJS.Timeout
    private readonly abortController: AbortController
    private recoveryIntervalStarted = false

    constructor(config: PeerDiscoveryConfig) {
        this.config = config
        this.abortController = new AbortController()
    }

    async joinDht(entryPointDescriptor: PeerDescriptor, doRandomJoin = true, _retry = true): Promise<void> {
        if (this.stopped) {
            return
        }
        this.joinCalled = true
        logger.debug(
            `Joining ${this.config.serviceId === 'layer0' ? 'The Streamr Network' : `Control Layer for ${this.config.serviceId}`}`
            + ` via entrypoint ${keyFromPeerDescriptor(entryPointDescriptor)}`
        )
        if (isSamePeerDescriptor(entryPointDescriptor, this.config.ownPeerDescriptor)) {
            return
        }
        this.config.connectionManager?.lockConnection(entryPointDescriptor, `${this.config.serviceId}::joinDht`)
        this.config.peerManager.handleNewPeers([entryPointDescriptor])

        const sessionOptions = {
            targetId: this.config.ownPeerDescriptor!.kademliaId,
            parallelism: this.config.parallelism,
            noProgressLimit: this.config.joinNoProgressLimit,
            peerManager: this.config.peerManager
        }
        const session = new DiscoverySession(sessionOptions)
        const randomSession = doRandomJoin ? new DiscoverySession({
            ...sessionOptions,
            targetId: crypto.randomBytes(8)
        }) : null
        this.ongoingDiscoverySessions.set(session.sessionId, session)
        if (randomSession) {
            this.ongoingDiscoverySessions.set(randomSession.sessionId, randomSession)
        }
        try {
            await session.findClosestNodes(this.config.joinTimeout)
            if (randomSession) {
                await randomSession.findClosestNodes(this.config.joinTimeout)
            }
        } catch (_e) {
            logger.debug(`DHT join on ${this.config.serviceId} timed out`)
        } finally {
            if (!this.stopped) {
                if (this.config.peerManager.getKBucketSize() === 0) {
                    this.rejoinDht(entryPointDescriptor).catch(() => {})
                } else {
                    await this.ensureRecoveryIntervalIsRunning()
                }
            }
            this.ongoingDiscoverySessions.delete(session.sessionId)
            if (randomSession) {
                this.ongoingDiscoverySessions.delete(randomSession.sessionId)
            }
            this.config.connectionManager?.unlockConnection(entryPointDescriptor, `${this.config.serviceId}::joinDht`)
        }
    }

    public async rejoinDht(entryPoint: PeerDescriptor): Promise<void> {
        if (this.stopped || this.rejoinOngoing) {
            return
        }
        logger.debug(`Rejoining DHT ${this.config.serviceId}`)
        this.rejoinOngoing = true
        try {
            await this.joinDht(entryPoint)
            logger.debug(`Rejoined DHT successfully ${this.config.serviceId}!`)
        } catch (err) {
            logger.warn(`Rejoining DHT ${this.config.serviceId} failed`)
            if (!this.stopped) {
                setAbortableTimeout(() => this.rejoinDht(entryPoint), 5000, this.abortController.signal)
            }
        } finally {
            this.rejoinOngoing = false
        }
    }

    private async ensureRecoveryIntervalIsRunning(): Promise<void> {
        if (!this.recoveryIntervalStarted) {
            this.recoveryIntervalStarted = true
            await scheduleAtInterval(() => this.fetchClosestPeersFromBucket(), 60000, true, this.abortController.signal)
        }
    }

    private async fetchClosestPeersFromBucket(): Promise<void> {
        if (this.stopped) {
            return
        }
        await Promise.allSettled(this.config.peerManager.getClosestPeersTo(
            this.config.ownPeerDescriptor.kademliaId, this.config.parallelism).map(async (peer: DhtPeer) => {
            const contacts = await peer.getClosestPeers(this.config.ownPeerDescriptor.kademliaId!)
            this.config.peerManager.handleNewPeers(contacts)
        }))
    }

    public isJoinOngoing(): boolean {
        return !this.joinCalled ? true : this.ongoingDiscoverySessions.size > 0
    }

    public isJoinCalled(): boolean {
        return this.joinCalled
    }

    public stop(): void {
        this.stopped = true
        this.abortController.abort()
        if (this.rejoinTimeoutRef) {
            clearTimeout(this.rejoinTimeoutRef)
            this.rejoinTimeoutRef = undefined
        }
        this.ongoingDiscoverySessions.forEach((session, _id) => {
            session.stop()
        })
    }
}
