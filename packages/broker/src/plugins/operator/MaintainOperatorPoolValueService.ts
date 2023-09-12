import { Logger, scheduleAtInterval } from '@streamr/utils'
import { MaintainOperatorPoolValueHelper } from './MaintainOperatorPoolValueHelper'
import { OperatorServiceConfig } from './OperatorPlugin'

const logger = new Logger(module)

const DEFAULT_CHECK_VALUE_INTERVAL_MS = 1000 * 60 * 60 * 24 // 1 day
const DEFAULT_WITHDRAW_LIMIT_SAFETY_FRACTION = 0.5 // 50%

export class MaintainOperatorPoolValueService {
    private readonly withdrawLimitSafetyFraction: number
    private readonly helper: MaintainOperatorPoolValueHelper
    private readonly abortController: AbortController
    private readonly checkIntervalInMs: number

    constructor(
        config: OperatorServiceConfig,
        withdrawLimitSafetyFraction = DEFAULT_WITHDRAW_LIMIT_SAFETY_FRACTION,
        checkValueIntervalMs = DEFAULT_CHECK_VALUE_INTERVAL_MS
    ) {
        this.withdrawLimitSafetyFraction = withdrawLimitSafetyFraction
        this.helper = new MaintainOperatorPoolValueHelper(config)
        this.abortController = new AbortController()
        this.checkIntervalInMs = checkValueIntervalMs
    }

    async start(): Promise<void> {
        await scheduleAtInterval(
            () => this.checkMyUnwithdrawnEarnings().catch((err) => {
                logger.error('Encountered error while checking unwithdrawn earnings', { err })
            }),
            this.checkIntervalInMs,
            true,
            this.abortController.signal
        )
    }

    private async checkMyUnwithdrawnEarnings(): Promise<void> {
        logger.info('Check whether it is time to withdraw my earnings')
        const { sumDataWei, rewardThresholdDataWei, sponsorshipAddresses } = await this.helper.getMyUnwithdrawnEarnings()
        const triggerWithdrawLimitDataWei = rewardThresholdDataWei * BigInt(1e18 * (1 - this.withdrawLimitSafetyFraction)) / BigInt(1e18)
        logger.trace(` -> is ${sumDataWei} > ${triggerWithdrawLimitDataWei} ?`)
        if (sumDataWei > triggerWithdrawLimitDataWei) {
            logger.info('Withdraw earnings from sponsorships', { sponsorshipAddresses })
            await this.helper.withdrawMyEarningsFromSponsorships(sponsorshipAddresses)
        } else {
            logger.info('Skip withdrawing earnings')
        }
    }

    async stop(): Promise<void> {
        this.abortController.abort()
    }
}