import { ConnectionManager, ListeningRpcCommunicator, NodeType, PeerDescriptor, PeerID, Simulator } from '@streamr/dht'
import { createPeerDescriptor } from '@streamr/dht/dist/src/dht/DhtNode'
import { AutoCertifierClient } from '@streamr/autocertifier-client'
import os from 'os'
import fs from 'fs'
import { Logger, filePathToNodeFormat } from '@streamr/utils'
import { SessionIdRequest, SessionIdResponse } from '../../src/proto/packages/autocertifier/protos/AutoCertifier'

const logger = new Logger(module)

let restServerCa: string

describe('production', () => {

    const restServerUrl = process.env['REST_SERVER_URL']
    if (!restServerUrl) {
        throw new Error('REST_SERVER_URL environment variable is not set')
    }

    const restServerCACertPath = process.env['REST_SERVER_CA_CERT_PATH']
    if (!restServerUrl) {
        throw new Error('REST_SERVER_CA_CERT_PATH environment variable is not set')
    }
    const subdomainPath = os.tmpdir() + '/subdomain.json'

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

    beforeEach(async () => {

        if (fs.existsSync(subdomainPath)) {
            fs.unlinkSync(subdomainPath)
        }

        restServerCa = fs.readFileSync(filePathToNodeFormat(restServerCACertPath!), 'utf8')

        clientConnectionManager = new ConnectionManager({
            transportLayer: mockTransport,
            websocketHost: '127.0.0.1',
            websocketPortRange: { min: 9991, max: 9995 }
        })

        await clientConnectionManager.start((report) => {
            expect(report.host).toEqual('127.0.0.1')
            expect(report.openInternet).toEqual(true)
            return createPeerDescriptor(report)
        })
    })

    afterEach(async () => {
        if (fs.existsSync(subdomainPath)) {
            fs.unlinkSync(subdomainPath)
        }

        if (clientRpcCommunicator) {
            await clientRpcCommunicator.stop()
        }
        await clientConnectionManager.stop()
        await client.stop()
    })

    it('The client can start', (done) => {
        const streamrWebSocketPort = clientConnectionManager.getPeerDescriptor().websocket!.port

        logger.info(subdomainPath)
        logger.info(restServerUrl)
        
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
            logger.info('received a subdomain')
            logger.info(JSON.stringify(subdomain))
            done()
        })

        client.start().then(() => { return }).catch((e) => {
            expect(e).toBeFalsy()
        })
    }, 120000)

    it('The client can start if the subdomain already exits', async () => {
        const streamrWebSocketPort = clientConnectionManager.getPeerDescriptor().websocket!.port

        logger.info(subdomainPath)
        logger.info(restServerUrl)
        
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

        await client.start()
        await client.stop()
        await client.start()

    }, 120000)
})