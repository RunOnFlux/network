import { ConnectionManager, ListeningRpcCommunicator, NodeType, PeerDescriptor, PeerID, Simulator } from '@streamr/dht'
import { createPeerDescriptor } from '@streamr/dht/dist/src/dht/DhtNode'
import { AutoCertifierClient } from '@streamr/autocertifier-client'
import os from 'os'
import fs from 'fs'
import { CertifiedSubdomain } from '@streamr/autocertifier-client'
import { Logger } from '@streamr/utils'
import { SessionIdRequest, SessionIdResponse } from '../../src/proto/packages/autocertifier/protos/AutoCertifier'

const logger = new Logger(module)

let restServerCa: string
let certifiedSubdomain: CertifiedSubdomain

describe('production', () => {

    const restServerUrl = process.env['REST_SERVER_URL']
    if (!restServerUrl) {
        throw new Error('REST_SERVER_URL environment variable is not set')
    }

    const restServerCACertPath = process.env['REST_SERVER_CA_CERT_PATH']
    if (!restServerUrl) {
        throw new Error('REST_SERVER_CA_CERT_PATH environment variable is not set')
    }
    const subdomainPath = os.tmpdir() + 'subdomain.json'

    const mockPeerDescriptor1: PeerDescriptor = {
        kademliaId: PeerID.fromString('tester1').value,
        nodeName: 'tester1',
        type: NodeType.NODEJS
    }

    const simulator = new Simulator()
    const mockTransport = new ConnectionManager({ ownPeerDescriptor: mockPeerDescriptor1, simulator: simulator })

    let clientConnectionManager: ConnectionManager
    let clientRpcCommunicator: ListeningRpcCommunicator | undefined

    let client: AutoCertifierClient

    beforeAll(async () => {

        if (fs.existsSync(subdomainPath)) {
            fs.unlinkSync(subdomainPath)
        }

        restServerCa = fs.readFileSync(restServerCACertPath!, 'utf8')

        clientConnectionManager = new ConnectionManager({
            transportLayer: mockTransport,
            websocketHost: '127.0.0.1',
            websocketPortRange: { min: 9991, max: 9991 }
        })

        await clientConnectionManager.start((report) => {
            expect(report.host).toEqual('127.0.0.1')
            expect(report.openInternet).toEqual(true)
            return createPeerDescriptor(report)
        })
    })

    afterAll(async () => {
        await clientConnectionManager.stop()
    })

    afterEach(async () => {
        if (fs.existsSync(subdomainPath)) {
            fs.unlinkSync(subdomainPath)
        }

        if (clientRpcCommunicator) {
            await clientRpcCommunicator.stop()
        }
        await client.stop()
    })

    it.only('The client can start', (done) => {
        const streamrWebSocketPort = clientConnectionManager.getPeerDescriptor().websocket!.port

        client = new AutoCertifierClient(subdomainPath, streamrWebSocketPort,
            restServerUrl, restServerCa, (serviceId, rpcMethodName, method) => {
                clientRpcCommunicator = new ListeningRpcCommunicator(serviceId, clientConnectionManager)
                clientRpcCommunicator.registerRpcMethod(
                    SessionIdRequest,
                    SessionIdResponse,
                    rpcMethodName,
                    method
                )
            })

        client.on('updatedSubdomain', (subdomain) => {
            logger.info(JSON.stringify(subdomain))
            expect(subdomain).toEqual(certifiedSubdomain)
            done()
        })

        client.start().then(() => { return }).catch((e) => { done.fail(e) })
    })

    it('Starting the client throws an exception if AutoCertifier cannot connect to it using WebSocket', async () => {
        const streamrWebSocketPort = 100

        client = new AutoCertifierClient(subdomainPath, streamrWebSocketPort,
            restServerUrl, restServerCa, (serviceId, rpcMethodName, method) => {
                clientRpcCommunicator = new ListeningRpcCommunicator(serviceId, clientConnectionManager)
                clientRpcCommunicator.registerRpcMethod(
                    SessionIdRequest,
                    SessionIdResponse,
                    rpcMethodName,
                    method
                )
            })

        await expect(client.start()).rejects.toThrow('Autocertifier failed to connect')
    })
})