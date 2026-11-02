import { DAY_MS, HOUR_MS, systemClock } from './time.js';
import type {
  Clock,
  EngineOptions,
  PolicyConfig,
  PolicyEvaluation,
  PolicyRejectionReason,
  StellarPublicKey,
  Stroops,
} from './types.js';
import { assertNonNegativeInteger, validateClock, validatePolicyConfig } from './validation.js';

interface SpendRecord {
  at: number;
  cost: Stroops;
}

function reject(reason: PolicyRejectionReason, detail: string): PolicyEvaluation {
  return { approved: false, reason, detail };
}

/**
 * Decides whether a transaction should be sponsored, based on allow/deny lists, a per-transaction
 * fee ceiling and rolling hourly and daily spend caps per source account.
 *
 * State is held in memory and is per process. See the README "Limitations" section.
 */
export class PolicyEngine {
  private readonly allowlist: ReadonlySet<StellarPublicKey>;
  private readonly denylist: ReadonlySet<StellarPublicKey>;
  private readonly maxFeeStroopsPerTx: Stroops;
  private readonly hourlyCap: Stroops;
  private readonly dailyCap: Stroops;
  private readonly now: Clock;
  private readonly history = new Map<StellarPublicKey, SpendRecord[]>();

  /**
   * @param config - Policy limits. Validated with {@link validatePolicyConfig}.
   * @param options - `now` overrides the clock (defaults to `Date.now`).
   * @throws {TypeError | RangeError} if the config or options are invalid.
   */
  constructor(config: PolicyConfig, options?: EngineOptions) {
    validatePolicyConfig(config);
    validateClock(options?.now);
    this.allowlist = new Set(config.allowlist);
    this.denylist = new Set(config.denylist);
    this.maxFeeStroopsPerTx = config.maxFeeStroopsPerTx;
    this.hourlyCap = config.hourlyCapStroopsPerAccount;
    this.dailyCap = config.dailyCapStroopsPerAccount;
    this.now = options?.now ?? systemClock;
  }

  /**
   * Evaluates a sponsorship request without changing any state.
   *
   * Checks run in order and the first failure is returned: denylist, allowlist, per-transaction
   * maximum, rolling hourly cap, rolling daily cap. Landing exactly on a cap is approved.
   *
   * @param sourceAccount - The account whose transaction would be sponsored.
   * @param costStroops - What the sponsor would actually pay, in stroops.
   * @throws {TypeError | RangeError} if `costStroops` is not a non-negative integer.
   */
  evaluate(sourceAccount: string, costStroops: Stroops): PolicyEvaluation {
    assertNonNegativeInteger(costStroops, 'costStroops');

    if (this.denylist.has(sourceAccount)) {
      return reject('DENYLISTED_ACCOUNT', `Account ${sourceAccount} is on the denylist.`);
    }
    if (this.allowlist.size > 0 && !this.allowlist.has(sourceAccount)) {
      return reject('NOT_ALLOWLISTED', `Account ${sourceAccount} is not on the allowlist.`);
    }
    if (costStroops > this.maxFeeStroopsPerTx) {
      return reject(
        'FEE_EXCEEDS_MAX',
        `Cost ${costStroops} stroops exceeds the per-transaction maximum of ` +
          `${this.maxFeeStroopsPerTx} stroops.`,
      );
    }

    const now = this.now();
    const { hourly, daily } = this.spendSince(sourceAccount, now);

    if (hourly + costStroops > this.hourlyCap) {
      return reject(
        'HOURLY_CAP_EXCEEDED',
        `Account ${sourceAccount} has been sponsored ${hourly} stroops in the last hour; ` +
          `adding ${costStroops} stroops would total ${hourly + costStroops}, over the hourly ` +
          `cap of ${this.hourlyCap} stroops.`,
      );
    }
    if (daily + costStroops > this.dailyCap) {
      return reject(
        'DAILY_CAP_EXCEEDED',
        `Account ${sourceAccount} has been sponsored ${daily} stroops in the last 24 hours; ` +
          `adding ${costStroops} stroops would total ${daily + costStroops}, over the daily ` +
          `cap of ${this.dailyCap} stroops.`,
      );
    }

    return { approved: true };
  }

  /**
   * Records spend that actually happened. Call this only after a sponsored transaction was
   * submitted successfully, so rejected or failed attempts never count towards the caps.
   *
   * Also prunes this account's records older than 24 hours.
   *
   * @param sourceAccount - The account that was sponsored.
   * @param costStroops - What the sponsor actually paid, in stroops.
   * @throws {TypeError | RangeError} if `costStroops` is not a non-negative integer.
   */
  recordSponsorship(sourceAccount: string, costStroops: Stroops): void {
    assertNonNegativeInteger(costStroops, 'costStroops');
    const now = this.now();
    const records = (this.history.get(sourceAccount) ?? []).filter((r) => now - r.at < DAY_MS);
    records.push({ at: now, cost: costStroops });
    this.history.set(sourceAccount, records);
  }

  private spendSince(sourceAccount: string, now: number): { hourly: Stroops; daily: Stroops } {
    let hourly = 0;
    let daily = 0;
    for (const record of this.history.get(sourceAccount) ?? []) {
      const age = now - record.at;
      if (age < DAY_MS) daily += record.cost;
      if (age < HOUR_MS) hourly += record.cost;
    }
    return { hourly, daily };
  }
}
