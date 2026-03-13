import { CadenceTransaction } from './flowActionsBuilder';

export interface SchedulerRegistration {
  streamId: string;
  handlerType: string;
  intervalSeconds: number;
  firstFireDelay: number;
  ruleId: string;
}

export interface RegistrationResult {
  success: boolean;
  schedulerId?: string;
  error?: string;
}

/**
 * Registers a FlowTransactionScheduler handler for a given stream rule.
 * In production, this calls the Flow Scheduler SDK to schedule the handler.
 */
export async function registerScheduler(
  registration: SchedulerRegistration
): Promise<RegistrationResult> {
  const { streamId, handlerType, intervalSeconds, firstFireDelay, ruleId } = registration;

  console.log(
    `[SchedulerRegistrar] Registering ${handlerType} for stream ${streamId}`,
    `\n  Interval: ${intervalSeconds}s, First fire delay: ${firstFireDelay}s`
  );

  // Build the Cadence transaction for scheduler registration
  const schedulerCode = buildSchedulerTransaction(
    streamId,
    handlerType,
    intervalSeconds,
    firstFireDelay
  );

  // In production: send via FCL mutate with gasless payer
  // const txId = await sendGaslessTransaction(schedulerCode);

  const schedulerId = `${streamId}_${handlerType}_${Date.now()}`;

  return {
    success: true,
    schedulerId,
  };
}

/**
 * Builds the Cadence transaction code for registering a handler
 * with FlowTransactionScheduler.
 */
function buildSchedulerTransaction(
  streamId: string,
  handlerType: string,
  intervalSeconds: number,
  firstFireDelay: number
): CadenceTransaction {
  const code = `
// Register ${handlerType} with FlowTransactionScheduler
// Stream: ${streamId}, Interval: ${intervalSeconds}s

transaction(streamId: String, handlerType: String, intervalSeconds: UFix64, firstFireDelay: UFix64) {
  prepare(user: auth(Storage) &Account) {
    // FlowTransactionScheduler.schedule(
    //   handlerType: handlerType,
    //   streamId: streamId,
    //   delay: firstFireDelay,
    //   interval: intervalSeconds
    // )
    log("Scheduled ".concat(handlerType).concat(" for ").concat(streamId))
  }
}`;

  return {
    code,
    args: [
      { type: 'String', value: streamId },
      { type: 'String', value: handlerType },
      { type: 'UFix64', value: intervalSeconds.toFixed(1) },
      { type: 'UFix64', value: firstFireDelay.toFixed(1) },
    ],
    description: `Register ${handlerType} scheduler`,
  };
}

/**
 * Cancel a registered scheduler.
 */
export async function cancelScheduler(
  streamId: string,
  handlerType: string,
  schedulerId: string
): Promise<boolean> {
  console.log(
    `[SchedulerRegistrar] Cancelling ${handlerType} scheduler ${schedulerId} for stream ${streamId}`
  );
  // In production: revoke capability and cancel via FlowTransactionScheduler
  return true;
}

/**
 * List all active schedulers for a stream.
 */
export async function listSchedulers(
  streamId: string
): Promise<{ handlerType: string; schedulerId: string; nextFire: number }[]> {
  // In production: query FlowTransactionScheduler state
  return [];
}
