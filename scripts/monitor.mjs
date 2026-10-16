// Daily check of every active anchor account: enough balance for the next 60
// days, and (where a dapp anchors on a schedule) a recent enough anchor.
// Uses public addresses only; holds no keys. Exits 1 on any problem, so the
// scheduled GitHub run fails and GitHub emails the repo owner. If RESEND_API_KEY
// and ALERT_TO are set, it also sends one email through Resend.
import { ANCHOR_ADDRESSES, accountBalance, latestAnchor } from '../dist/index.js';

const MIN_DAYS_OF_SPEND = 60;

// dailySpendAlgo: expected fees per day. maxAgeHours: alert if the newest anchor
// is older than this; null for event-driven dapps (handovers, ledger closes).
// Turn fcs-signals freshness on (3) once FCS anchoring is live on that network.
const CHECKS = [
  { dapp: 'fcs-signals', network: 'testnet', dailySpendAlgo: 0.024, maxAgeHours: null },
  { dapp: 'kce-handover', network: 'testnet', dailySpendAlgo: 0.001, maxAgeHours: null },
  { dapp: 'kce-books', network: 'testnet', dailySpendAlgo: 0.001, maxAgeHours: null },
];

const problems = [];
const lines = [];

for (const check of CHECKS) {
  const active = ANCHOR_ADDRESSES[check.dapp][check.network].filter((entry) => entry.to === null);
  if (active.length === 0) {
    problems.push(`${check.dapp}/${check.network}: no active address`);
    continue;
  }
  for (const { address } of active) {
    const label = `${check.dapp}/${check.network} ${address.slice(0, 6)}`;
    const { amount, minBalance } = await accountBalance({ network: check.network, address });
    const spendable = (amount - minBalance) / 1e6;
    const days = spendable / check.dailySpendAlgo;
    lines.push(`${label}: ${(amount / 1e6).toFixed(3)} ALGO, about ${Math.max(0, Math.floor(days))} days of fees`);
    if (amount === 0) problems.push(`${label}: account is not funded`);
    else if (days < MIN_DAYS_OF_SPEND) problems.push(`${label}: only ${Math.floor(days)} days of fees left (${spendable.toFixed(3)} ALGO spendable)`);

    if (check.maxAgeHours !== null) {
      const latest = await latestAnchor({ network: check.network, dapp: check.dapp, address });
      const ageHours = latest ? (Date.now() / 1000 - latest.timestamp) / 3600 : Infinity;
      lines.push(`${label}: newest anchor ${latest ? `${ageHours.toFixed(1)} h ago` : 'never'}`);
      if (ageHours > check.maxAgeHours) problems.push(`${label}: newest anchor is ${latest ? `${ageHours.toFixed(1)} h` : 'missing'} (limit ${check.maxAgeHours} h)`);
    }
  }
}

console.log(lines.join('\n'));

if (problems.length > 0) {
  console.error('\nPROBLEMS:\n' + problems.map((p) => `- ${p}`).join('\n'));
  const { RESEND_API_KEY, ALERT_TO, ALERT_FROM = 'alerts@kcedynamics.com' } = process.env;
  if (RESEND_API_KEY && ALERT_TO) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_TO,
        subject: `Anchor monitor: ${problems.length} problem${problems.length === 1 ? '' : 's'}`,
        text: `${problems.map((p) => `- ${p}`).join('\n')}\n\nAll accounts:\n${lines.join('\n')}`,
      }),
    });
    if (!response.ok) console.error(`Resend returned ${response.status}`);
  }
  process.exit(1);
}
