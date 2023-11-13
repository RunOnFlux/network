import { createServer as createHttpServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http'
import { createServer as createHttpsServer, Server as HttpsServer } from 'https'
import EventEmitter from 'eventemitter3'
import { server as WsServer } from 'websocket'
import { ServerWebsocket } from './ServerWebsocket'
import {
    ConnectionSourceEvents
} from '../IConnectionSource'

import { Logger, asAbortable } from '@streamr/utils'
import { WebsocketServerStartError } from '../../helpers/errors'
import { PortRange, TlsCertificate } from '../ConnectionManager'
import { range } from 'lodash'
import fs from 'fs'

const logger = new Logger(module)

// NodeJsWsServer is declared as a global in test-browser Electron tests
// in preload.js using "window.NodeJsWsServer = require('websocket').server".
// This is done in order to use the real nodejs websocket server in tests
// instead of a dummy polyfill.

declare class NodeJsWsServer extends WsServer { }

interface WebsocketServerConfig {
    portRange: PortRange
    tlsCertificate?: TlsCertificate
    maxMessageSize?: number
}

export class WebsocketServer extends EventEmitter<ConnectionSourceEvents> {

    private httpServer?: HttpServer | HttpsServer
    private wsServer?: WsServer
    private readonly abortController = new AbortController()
    private readonly portRange: PortRange
    private readonly tlsCertificate?: TlsCertificate
    private readonly maxMessageSize: number

    constructor(config: WebsocketServerConfig) {
        super()
        this.portRange = config.portRange
        this.tlsCertificate = config.tlsCertificate
        this.maxMessageSize = config.maxMessageSize ?? 1048576
    }

    public async start(): Promise<number> {
        const ports = range(this.portRange.min, this.portRange.max + 1)
        for (const port of ports) {
            try {
                await asAbortable(this.startServer(port, this.tlsCertificate), this.abortController.signal)
                return port
            } catch (err) {
                if (err.originalError?.code === 'EADDRINUSE') {
                    logger.debug(`failed to start WebSocket server on port: ${port} reattempting on next port`)
                } else {
                    throw new WebsocketServerStartError(err)
                }
            }
        }
        throw new WebsocketServerStartError(`Failed to start WebSocket server on any port in range: ${this.portRange.min}-${this.portRange.min}`)
    }

    private startServer(port: number, tlsCertificate?: TlsCertificate): Promise<void> {
        const requestListener = (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => {
            logger.trace('Received request for ' + request.url)
            response.writeHead(404)
            response.end()
        }
        return new Promise((resolve, reject) => {
            this.httpServer = tlsCertificate ? 
                createHttpsServer({
                    key: fs.readFileSync(tlsCertificate.privateKeyFileName),
                    cert: fs.readFileSync(tlsCertificate.certFileName)
                }, requestListener)
                : 
                createHttpServer(requestListener)

            function originIsAllowed() {
                return true
            }

            this.wsServer = this.createWsServer(this.httpServer)
            
            this.wsServer.on('request', (request) => {
                if (!originIsAllowed()) {
                    // Make sure we only accept requests from an allowed origin
                    request.reject()
                    logger.trace('IConnection from origin ' + request.origin + ' rejected.')
                    return
                }
                
                const connection = request.accept(undefined, request.origin)
                
                logger.trace('IConnection accepted.')

                this.emit('connected', new ServerWebsocket(connection, request.resourceURL))
            })
            this.httpServer.once('error', (err: Error) => {
                reject(new WebsocketServerStartError('Starting Websocket server failed', err))
            })

            this.httpServer.once('listening', () => {
                logger.debug('Websocket server is listening on port ' + port)
                resolve()
            })

            try {
                // Listen only to IPv4 network interfaces, default value listens to IPv6 as well
                this.httpServer.listen(port, '0.0.0.0')
            } catch (e) {
                reject(new WebsocketServerStartError('Websocket server threw an exception', e))
            }
        })
    }

    public stop(): Promise<void> {
        this.abortController.abort()
        this.removeAllListeners()
        return new Promise((resolve, _reject) => {
            this.wsServer?.shutDown()
            this.httpServer?.close(() => {
                resolve()
            })
        })
    }

    private createWsServer(httpServer: HttpServer | HttpsServer): WsServer {
        // Use the real nodejs WebSocket server in Electron tests

        if (typeof NodeJsWsServer !== 'undefined') {
            return new NodeJsWsServer({
                httpServer,
                autoAcceptConnections: false,
                maxReceivedMessageSize: this.maxMessageSize
            })
        } else {
            return this.wsServer = new WsServer({
                httpServer,
                autoAcceptConnections: false,
                maxReceivedMessageSize: this.maxMessageSize
            })
        }
    }
}