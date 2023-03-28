import { Any } from '../../src/proto/google/protobuf/any'
import { NodeType, PeerDescriptor } from '../../src/proto/packages/dht/protos/DhtRpc'
import {
    isSamePeerDescriptor,
    peerIdFromPeerDescriptor
} from '../../src/helpers/peerIdFromPeerDescriptor'
import { LocalDataStore } from '../../src/dht/store/LocalDataStore'

describe('LocalDataStore', () => {
    let localDataStore: LocalDataStore
    const storer1: PeerDescriptor = {
        kademliaId: new Uint8Array([1, 2, 3]),
        type: NodeType.NODEJS,
        nodeName: 'storer1'
    }
    const storer2: PeerDescriptor = {
        kademliaId: new Uint8Array([3, 2, 1]),
        type: NodeType.NODEJS,
        nodeName: 'storer2'
    }
    const data1 = Any.pack(storer1, PeerDescriptor)
    const data2 = Any.pack(storer2, PeerDescriptor)

    beforeEach(() => {
        localDataStore = new LocalDataStore()
    })

    it('can store', () => {
        const dataKey = peerIdFromPeerDescriptor(storer1)
        localDataStore.storeEntry(storer1, dataKey, data1, 10000)
        const fetchedData = localDataStore.getEntry(dataKey)
        fetchedData!.forEach((entry) => {
            const fetchedDescriptor = Any.unpack(entry.data!, PeerDescriptor)
            expect(isSamePeerDescriptor(fetchedDescriptor, storer1)).toBeTrue()
        })
    })

    it('multiple storers behind one key', () => {
        const dataKey = peerIdFromPeerDescriptor(storer1)
        localDataStore.storeEntry(storer1, dataKey, data1, 10000)
        localDataStore.storeEntry(storer2, dataKey, data1, 10000)
        const fetchedData = localDataStore.getEntry(dataKey)
        fetchedData!.forEach((entry) => {
            const fetchedDescriptor = Any.unpack(entry.data!, PeerDescriptor)
            expect(isSamePeerDescriptor(fetchedDescriptor, storer1)).toBeTrue()
        })
    })

    it('can remove data entries', () => {
        const dataKey = peerIdFromPeerDescriptor(storer1)
        localDataStore.storeEntry(storer1, dataKey, data1, 10000)
        localDataStore.storeEntry(storer2, dataKey, data2, 10000)
        localDataStore.deleteEntry(dataKey, storer1)
        const fetchedData = localDataStore.getEntry(dataKey)
        fetchedData!.forEach((entry) => {
            const fetchedDescriptor = Any.unpack(entry.data!, PeerDescriptor)
            expect(isSamePeerDescriptor(fetchedDescriptor, storer2)).toBeTrue()
        })
    })

})