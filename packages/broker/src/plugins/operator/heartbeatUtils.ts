import { z } from 'zod'
import { NetworkNodeType, NetworkPeerDescriptor } from 'streamr-client'

export const HeartbeatMessageSchema = z.object({
    msgType: z.enum(['heartbeat']),
    peerDescriptor: z.object({
        id: z.string(),
        type: z.optional(z.nativeEnum(NetworkNodeType)),
        websocket: z.optional(z.object({
            ip: z.string(),
            port: z.number()
        })),
        openInternet: z.optional(z.boolean()),
        region: z.optional(z.number())
    })
})

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>

export function createHeartbeatMessage(peerDescriptor: NetworkPeerDescriptor): HeartbeatMessage {
    return {
        msgType: 'heartbeat',
        peerDescriptor
    }
}