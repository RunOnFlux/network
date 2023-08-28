import { StreamMessage, StreamMessageAESEncrypted } from '@streamr/protocol'
import { EncryptionUtil, DecryptError } from '../encryption/EncryptionUtil'
import { DestroySignal } from '../DestroySignal'
import { GroupKey } from '../encryption/GroupKey'
import { GroupKeyManager } from '../encryption/GroupKeyManager'
import { byteArrayToEthereumAddress } from '@streamr/utils'

// TODO if this.destroySignal.isDestroyed() is true, would it make sense to reject the promise
// and not to return the original encrypted message?
// - e.g. StoppedError, which is not visible to end-user
export const decrypt = async (
    streamMessage: StreamMessageAESEncrypted,
    groupKeyManager: GroupKeyManager,
    destroySignal: DestroySignal,
): Promise<StreamMessage> => {
    if (destroySignal.isDestroyed()) {
        return streamMessage
    }
    let groupKey: GroupKey | undefined
    const publisherEthereumAddress = byteArrayToEthereumAddress(streamMessage.getPublisherId())
    try {
        groupKey = await groupKeyManager.fetchKey(
            streamMessage.getStreamPartID(),
            streamMessage.groupKeyId,
            publisherEthereumAddress
        )
    } catch (e: any) {
        if (destroySignal.isDestroyed()) {
            return streamMessage
        }
        throw new DecryptError(streamMessage, `Could not get GroupKey ${streamMessage.groupKeyId}: ${e.message}`)
    }
    if (destroySignal.isDestroyed()) {
        return streamMessage
    }
    const clone = streamMessage.clone()
    EncryptionUtil.decryptStreamMessage(clone, groupKey)
    if (streamMessage.newGroupKey) {
        // newGroupKey has been converted into GroupKey
        await groupKeyManager.addKeyToLocalStore(
            clone.newGroupKey as unknown as GroupKey,
            publisherEthereumAddress
        )
    }
    return clone
}
