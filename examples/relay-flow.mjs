// Run with: npm run example   (builds the package, then runs this script)
//
// Shows how a sponsorship service (relay, wallet backend, anchor...) uses the engine:
// rate limit -> evaluate -> sponsor -> record.
// "Sponsoring" is simulated here; a real service would build and submit a FeeBumpTransaction.
import { PolicyEngine, RateLimiter } from '../dist/index.js';

const BASE_FEE = 100; // stroops per operation

const policy = new PolicyEngine({
  allowlist: [], // anyone who is not denylisted
  denylist: ['GBADACTORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'],
  maxFeeStroopsPerTx: 10_000, // 0.001 XLM
  hourlyCapStroopsPerAccount: 1_000, // 0.0001 XLM
  dailyCapStroopsPerAccount: 5_000,
});

const limiter = new RateLimiter({ perAccountPerMinute: 6, perIpPerMinute: 20 });

/** What the sponsor pays for a fee bump: baseFee * (inner operations + 1). */
function feeBumpCost(innerOperationCount) {
  return BASE_FEE * (innerOperationCount + 1);
}

async function submitFeeBump() {
  // Placeholder for: build FeeBumpTransaction, sign with sponsor key, submit to Horizon/RPC.
  return { successful: true };
}

async function handleSponsorRequest({ sourceAccount, sourceIp, innerOperationCount }) {
  if (!limiter.tryConsumeIp(sourceIp) || !limiter.tryConsumeAccount(sourceAccount)) {
    return { status: 429, body: { error: 'RATE_LIMITED' } };
  }

  const cost = feeBumpCost(innerOperationCount);
  const decision = policy.evaluate(sourceAccount, cost);
  if (!decision.approved) {
    return { status: 403, body: { error: decision.reason, detail: decision.detail } };
  }

  const result = await submitFeeBump();
  if (!result.successful) {
    return { status: 502, body: { error: 'SUBMISSION_FAILED' } }; // nothing recorded
  }

  policy.recordSponsorship(sourceAccount, cost); // only after it actually happened
  return { status: 200, body: { sponsored: cost } };
}

const alice = 'GALICEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const requests = [
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 1 }, // 200 stroops
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 3 }, // 400 stroops
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 2 }, // 300 -> 900 total
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 1 }, // 200 -> over 1,000
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 0 }, // 100 -> exactly 1,000
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 200 }, // too expensive (6th request)
  { sourceAccount: alice, sourceIp: '203.0.113.7', innerOperationCount: 0 }, // 7th: rate limited
  {
    sourceAccount: 'GBADACTORXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    sourceIp: '198.51.100.1',
    innerOperationCount: 1,
  },
];

for (const request of requests) {
  const response = await handleSponsorRequest(request);
  console.log(`${request.sourceAccount.slice(0, 9)}… ops=${request.innerOperationCount}`, response);
}
