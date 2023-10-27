import EventEmitter from "eventemitter3"
import { AutoCertifierClientFacade, IAutoCertifierClient } from "../../src/connection/WebSocket/AutoCertifierClientFacade"

class mockAutoCertifierClient extends EventEmitter {
    constructor() {
        super()
    }
    start = async () => {
        this.emit('updatedSubdomain', {})
    }
    stop = () => {}
    updateSubdomain = () => {
        this.emit('updatedSubdomain', {})
    }
}

describe('AutoCertifierClientFacade', () => {

    let client: AutoCertifierClientFacade
    let mockClient: IAutoCertifierClient
    let setHost: jest.Mock
    let updateCertificate: jest.Mock

    beforeEach(() => {
        mockClient = new mockAutoCertifierClient()
        const mockClientFactory = (): IAutoCertifierClient => mockClient
        setHost = jest.fn()
        updateCertificate = jest.fn()
        client = new AutoCertifierClientFacade({
            autocertifierUrl: '',
            autocertifierRpcCommunicator: {} as any,
            wsServerPort: 0,
            setHost,
            updateCertificate,
            createClientFactory: mockClientFactory
        })
    }) 

    afterEach(() => {
        client.stop()
    })

    it('start', async () => {
        await client.start()
        expect(setHost).toBeCalled()
        expect(updateCertificate).toBeCalled()
    })

    it('updated events are processed', async () => {
        await client.start()
        expect(setHost).toBeCalledTimes(1)
        expect(updateCertificate).toBeCalledTimes(1);
        (mockClient as mockAutoCertifierClient).updateSubdomain()
        expect(setHost).toBeCalledTimes(2)
        expect(updateCertificate).toBeCalledTimes(2)
    })

})
