import { DhtNode } from '../dht/DhtNode'
import { ExternalStoreDataRequest, ExternalStoreDataResponse, FindDataRequest, FindDataResponse, FindMode } from '../proto/packages/dht/protos/DhtRpc'

export const registerExternalApiRpcMethods = (thisNode: DhtNode): void => {
    const rpcCommunicator = thisNode.getRpcCommunicator()
    rpcCommunicator.registerRpcMethod(
        FindDataRequest, 
        FindDataResponse, 
        'findData', 
        (req: FindDataRequest) => findData(thisNode, req),
        { timeout: 10000 }
    )
    rpcCommunicator.registerRpcMethod(
        ExternalStoreDataRequest,
        ExternalStoreDataResponse,
        'externalStoreData',
        (req: ExternalStoreDataRequest) => externalStoreData(thisNode, req),
        { timeout: 10000 }
    )
}

// IDHTRpcService method for external findRecursive calls
const findData = async (thisNode: DhtNode, findDataRequest: FindDataRequest): Promise<FindDataResponse> => {
    const result = await thisNode.startRecursiveFind(findDataRequest.kademliaId, FindMode.DATA, findDataRequest.requestor)
    if (result.dataEntries) {
        return FindDataResponse.create({ dataEntries: result.dataEntries })
    } else {
        return FindDataResponse.create({ 
            dataEntries: [],
            error: 'Could not find data with the given key' 
        })
    }
}

// IDHTRpcService method for external storeData calls
const externalStoreData = async (thisNode: DhtNode, request: ExternalStoreDataRequest): Promise<ExternalStoreDataResponse> => {
    const result = await thisNode.storeDataToDht(request.key, request.data!)
    return ExternalStoreDataResponse.create({
        storers: result
    })
}