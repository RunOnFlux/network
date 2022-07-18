import { BucketCollector } from './BucketCollector'
import {
    Claim,
    ErrorCode,
    ErrorResponse, Receipt,
    ReceiptRequest,
    ReceiptResponse,
    toStreamPartID
} from 'streamr-client-protocol'
import { Event as NodeToNodeEvent, NodeToNode } from '../../protocol/NodeToNode'
import { PeerInfo } from '../../connection/PeerInfo'
import { NodeId } from '../../identifiers'
import { BucketID, formBucketID } from './Bucket'
import { Signers } from './SignatureFunctions'
import { ReceiptStore } from './ReceiptStore'
import { Logger } from '@streamr/utils'

const logger = new Logger(module)

function getBucketIdFromClaim(claim: Claim): BucketID {
    return formBucketID({
        nodeId: claim.sender,
        streamPartId: toStreamPartID(claim.streamId, claim.streamPartition),
        publisherId: claim.publisherId,
        msgChainId: claim.msgChainId,
        windowNumber: claim.windowNumber
    })
}

export class ReceiptResponder {
    private readonly myNodeId: NodeId
    private readonly nodeToNode: NodeToNode
    private readonly receiptStore: ReceiptStore
    private readonly signers: Signers
    private readonly collector: BucketCollector

    constructor(myPeerInfo: PeerInfo, nodeToNode: NodeToNode, receiptStore: ReceiptStore, signers: Signers) {
        this.myNodeId = myPeerInfo.peerId
        this.nodeToNode = nodeToNode
        this.receiptStore = receiptStore
        this.signers = signers
        this.collector = new BucketCollector()
        nodeToNode.on(NodeToNodeEvent.DATA_RECEIVED, (broadcastMessage, nodeId) => {
            this.collector.record(broadcastMessage.streamMessage, nodeId)
        })
        nodeToNode.on(NodeToNodeEvent.RECEIPT_REQUEST_RECEIVED, this.onReceiptRequest.bind(this))
    }

    private onReceiptRequest({ requestId, claim }: ReceiptRequest, source: NodeId): void {
        if (source !== claim.sender) {
            logger.warn('identity mismatch: source of message !== claim.sender')
            this.sendErrorResponse(claim, requestId, ErrorCode.SENDER_IDENTITY_MISMATCH)
            return
        }
        if (!this.signers.claim.validate(claim)) {
            logger.warn('signature validation failed for claim %j', claim)
            this.sendErrorResponse(claim, requestId, ErrorCode.INVALID_SIGNATURE)
            return
        }
        const bucket = this.collector.getBucket(getBucketIdFromClaim(claim))
        if (bucket === undefined) {
            logger.warn('bucket not found for claim %j', claim)
            this.sendErrorResponse(claim, requestId, ErrorCode.CLAIM_DISAGREEMENT)
            return
        }

        // TODO: inequality instead?
        if (bucket.getMessageCount() !== claim.messageCount || bucket.getTotalPayloadSize() !== claim.totalPayloadSize) {
            logger.warn("I disagree with claim %j (msgCount=%d, totalPayloadSize=%d)",
                claim,
                bucket.getMessageCount(),
                bucket.getTotalPayloadSize()
            )
            this.sendErrorResponse(claim, requestId, ErrorCode.CLAIM_DISAGREEMENT)
            return
        }

        logger.info("I agree with claim %j", claim)
        const receipt = {
            claim,
            signature: this.signers.receipt.sign({ claim })
        }
        this.receiptStore.store(receipt)
        this.sendReceiptResponse(receipt, requestId)
    }

    private sendReceiptResponse(receipt: Receipt, requestId: string): void {
        this.nodeToNode.send(receipt.claim.sender, new ReceiptResponse({
            requestId,
            receipt
        })).catch((e) => {
            logger.warn('failed to send ReceiptResponse(signature) to %s, reason: %s', receipt.claim.sender, e)
        })
    }

    private sendErrorResponse(claim: Claim, requestId: string, errorCode: ErrorCode): void {
        this.nodeToNode.send(claim.sender, new ErrorResponse({
            requestId,
            errorMessage: errorCode, // TODO: write something more human readable?
            errorCode
        })).catch((e) => {
            logger.warn('failed to send ReceiptResponse(refusal) to %s, reason: %s', claim.sender, e)
        })
    }
}
