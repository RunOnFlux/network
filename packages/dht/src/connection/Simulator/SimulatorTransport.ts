import { PeerDescriptor } from "../../proto/packages/dht/protos/DhtRpc"
import { ConnectionManager } from "../ConnectionManager"
import { Simulator } from "./Simulator"

export class SimulatorTransport extends ConnectionManager {
    constructor(ownPeerDescriptor: PeerDescriptor, simulator: Simulator) {
        super({ ownPeerDescriptor: ownPeerDescriptor, simulator, serviceIdPrefix: 'simulator/', nodeName: ownPeerDescriptor.nodeName })
    }
}