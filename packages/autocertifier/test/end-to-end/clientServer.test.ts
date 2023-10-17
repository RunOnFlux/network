import { ConnectionManager, ListeningRpcCommunicator, NodeType, PeerDescriptor, PeerID, Simulator } from '@streamr/dht'
import { createPeerDescriptor } from '@streamr/dht/dist/src/dht/DhtNode'
import { AutoCertifierClient } from '@streamr/autocertifier-client'
import os from 'os'
import fs from 'fs'
import { RestServer } from '../../src/RestServer'
import { CertifiedSubdomain } from '@streamr/autocertifier-client'
import { Session } from '@streamr/autocertifier-client'
import { v4 } from 'uuid'
import { Logger } from '@streamr/utils'
import { createSelfSignedCertificate } from '../../src/utlis/createSelfSignedCertificate'
import { StreamrChallenger } from '../../src/StreamrChallenger'
import { SessionIdRequest, SessionIdResponse } from '../../src/proto/packages/autocertifier/protos/AutoCertifier'

const logger = new Logger(module)

let server: RestServer
const dir = os.tmpdir()
let restServerCa: string
let certifiedSubdomain: CertifiedSubdomain

const createTestSubdomain = (validityMillis?: number) => {
    if (validityMillis) {
        const fakeCerts = createSelfSignedCertificate(1200)
        certifiedSubdomain = { subdomain: 'fwefwafeaw', token: 'token', certificate: { cert: fakeCerts.serverCert, key: fakeCerts.serverKey } }
    } else {
        const fakeCerts = createSelfSignedCertificate(0, validityMillis)
        certifiedSubdomain = { subdomain: 'fwefwafeaw', token: 'token', certificate: { cert: fakeCerts.serverCert, key: fakeCerts.serverKey } }
    }
}

describe('clientServer', () => {

    const restServerPort = '3000'

    const mockPeerDescriptor1: PeerDescriptor = {
        kademliaId: PeerID.fromString('tester1').value,
        nodeName: 'tester1',
        type: NodeType.NODEJS
    }
   
    const simulator = new Simulator()
    const mockTransport = new ConnectionManager({ ownPeerDescriptor: mockPeerDescriptor1, simulator: simulator })

    let clientConnectionManager: ConnectionManager
    let clientRpcCommunicator: ListeningRpcCommunicator | undefined

    const subdomainPath = os.tmpdir() + 'subdomain.json'

    let client: AutoCertifierClient

    beforeAll(async () => {

        if (fs.existsSync(subdomainPath)) {
            fs.unlinkSync(subdomainPath)
        }
        createTestSubdomain()
        server = new RestServer('127.0.0.1', restServerPort, dir + '/restServerCaCert.pem', dir + '/restServerCaKey.pem',
            dir + '/restServerCert.pem', dir + '/restServerKey.pem', {
                async createSession(): Promise<Session> {
                    return { sessionId: v4() }
                },
                async createNewSubdomainAndCertificate(ip: string, _port: string, streamrWebsocketPort: string,
                    sessionId: string, streamrWebSocketCaCert?: string): Promise<CertifiedSubdomain> {
                    const challenger = new StreamrChallenger()
                    await challenger.testStreamrChallenge(ip, streamrWebsocketPort, sessionId, streamrWebSocketCaCert)
                    return certifiedSubdomain
                },
                async createNewCertificateForSubdomain(_subdomain: string, _ipAddress: string,
                    _port: string, _streamrWebSocketPort: string, _token: string): Promise<CertifiedSubdomain> {

                    return certifiedSubdomain
                },
                async updateSubdomainIpAndPort(_subdomain: string, _ip: string, _port: string, _streamrWebsocketPort: string, _token: string) {
                    // do nothing
                }
            })
        await server.start()
        restServerCa = fs.readFileSync(dir + '/restServerCaCert.pem', 'utf8')

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
        await server.stop()
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
     
    it('The client can start', (done) => {
        const streamrWebSocketPort = clientConnectionManager.getPeerDescriptor().websocket!.port
        const autoCertifierUrl = 'https://localhost:' + restServerPort

        client = new AutoCertifierClient(subdomainPath, streamrWebSocketPort,
            autoCertifierUrl, restServerCa, (serviceId, rpcMethodName, method) => {
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
        const autoCertifierUrl = 'https://localhost:' + restServerPort

        client = new AutoCertifierClient(subdomainPath, streamrWebSocketPort,
            autoCertifierUrl, restServerCa, (serviceId, rpcMethodName, method) => {
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