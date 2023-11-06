import { Logger } from '@streamr/utils'
import {
    ConnectivityResponse,
    PeerDescriptor
} from '../proto/packages/dht/protos/DhtRpc'
import { ITransport } from '../transport/ITransport'
import { PortRange, TlsCertificate } from './ConnectionManager'
import { ManagedConnection } from './ManagedConnection'
import { Simulator } from './simulator/Simulator'
import { SimulatorConnector } from './simulator/SimulatorConnector'
import { IceServer, WebrtcConnectorRpcLocal } from './webrtc/WebrtcConnectorRpcLocal'
import { WebsocketConnectorRpcLocal } from './websocket/WebsocketConnectorRpcLocal'

export interface ConnectorFacade {
    createConnection: (peerDescriptor: PeerDescriptor) => ManagedConnection
    getLocalPeerDescriptor: () => PeerDescriptor | undefined
    start: (
        onIncomingConnection: (connection: ManagedConnection) => boolean,
        canConnect: (peerDescriptor: PeerDescriptor) => boolean
    ) => Promise<void>
    stop: () => Promise<void>
}

const logger = new Logger(module)

export interface DefaultConnectorFacadeConfig {
    transport: ITransport
    websocketHost?: string
    websocketPortRange?: PortRange
    entryPoints?: PeerDescriptor[]
    iceServers?: IceServer[]
    webrtcAllowPrivateAddresses?: boolean
    webrtcDatachannelBufferThresholdLow?: number
    webrtcDatachannelBufferThresholdHigh?: number
    webrtcNewConnectionTimeout?: number
    externalIp?: string
    webrtcPortRange?: PortRange
    maxMessageSize?: number
    tlsCertificate?: TlsCertificate
    createLocalPeerDescriptor: (connectivityResponse: ConnectivityResponse) => PeerDescriptor
}

export class DefaultConnectorFacade implements ConnectorFacade {

    private readonly config: DefaultConnectorFacadeConfig
    private localPeerDescriptor?: PeerDescriptor
    private websocketConnector?: WebsocketConnectorRpcLocal
    private webrtcConnector?: WebrtcConnectorRpcLocal

    constructor(config: DefaultConnectorFacadeConfig) {
        this.config = config
    }

    async start(
        onIncomingConnection: (connection: ManagedConnection) => boolean,
        canConnect: (peerDescriptor: PeerDescriptor) => boolean
    ): Promise<void> {
        logger.trace(`Creating WebsocketConnectorRpcLocal`)
        this.websocketConnector = new WebsocketConnectorRpcLocal({
            transport: this.config.transport!,
            // TODO should we use canConnect also for WebrtcConnector? (NET-1142)
            canConnect: (peerDescriptor: PeerDescriptor) => canConnect(peerDescriptor),
            onIncomingConnection,
            portRange: this.config.websocketPortRange,
            host: this.config.websocketHost,
            entrypoints: this.config.entryPoints,
            tlsCertificate: this.config.tlsCertificate,
            maxMessageSize: this.config.maxMessageSize
        })
        logger.trace(`Creating WebRtcConnectorRpcLocal`)
        this.webrtcConnector = new WebrtcConnectorRpcLocal({
            transport: this.config.transport!,
            iceServers: this.config.iceServers,
            allowPrivateAddresses: this.config.webrtcAllowPrivateAddresses,
            bufferThresholdLow: this.config.webrtcDatachannelBufferThresholdLow,
            bufferThresholdHigh: this.config.webrtcDatachannelBufferThresholdHigh,
            connectionTimeout: this.config.webrtcNewConnectionTimeout,
            externalIp: this.config.externalIp,
            portRange: this.config.webrtcPortRange,
            maxMessageSize: this.config.maxMessageSize
        }, onIncomingConnection)
        await this.websocketConnector.start()
        const connectivityResponse = await this.websocketConnector.checkConnectivity()
        const localPeerDescriptor = this.config.createLocalPeerDescriptor(connectivityResponse)
        this.localPeerDescriptor = localPeerDescriptor
        this.websocketConnector.setLocalPeerDescriptor(localPeerDescriptor)
        this.webrtcConnector.setLocalPeerDescriptor(localPeerDescriptor)
    }

    createConnection(peerDescriptor: PeerDescriptor): ManagedConnection {
        if (this.websocketConnector!.isPossibleToFormConnection(peerDescriptor)) {
            return this.websocketConnector!.connect(peerDescriptor)
        } else {
            return this.webrtcConnector!.connect(peerDescriptor)
        }
    }

    getLocalPeerDescriptor(): PeerDescriptor | undefined {
        return this.localPeerDescriptor
    }

    async stop(): Promise<void> {
        await this.websocketConnector!.destroy()
        await this.webrtcConnector!.stop()
    }
}

export class SimulatorConnectorFacade implements ConnectorFacade {

    private readonly localPeerDescriptor: PeerDescriptor
    private simulatorConnector?: SimulatorConnector
    private simulator: Simulator

    constructor(localPeerDescriptor: PeerDescriptor, simulator: Simulator) {
        this.localPeerDescriptor = localPeerDescriptor
        this.simulator = simulator
    }

    async start(onIncomingConnection: (connection: ManagedConnection) => boolean): Promise<void> {
        logger.trace(`Creating SimulatorConnector`)
        this.simulatorConnector = new SimulatorConnector(
            this.localPeerDescriptor,
            this.simulator,
            onIncomingConnection
        )
        this.simulator.addConnector(this.simulatorConnector)
    }

    createConnection(peerDescriptor: PeerDescriptor): ManagedConnection {
        return this.simulatorConnector!.connect(peerDescriptor)
    }

    getLocalPeerDescriptor(): PeerDescriptor {
        return this.localPeerDescriptor
    }

    async stop(): Promise<void> {
        await this.simulatorConnector!.stop()
    }
}