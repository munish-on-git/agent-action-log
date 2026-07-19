# Agent Action Log

A tamper-evident, real-time commitment log for autonomous AI agents. Every action an
agent takes — reading a file, calling an API, editing something, deleting something —
gets hashed and committed to a Monad contract the instant it happens, not batched and
not written by the agent about itself afterward. Anyone can re-hash the offchain detail
and check it against the onchain commitment to see if the record was touched after
the fact.

## Problem
Agents already write their own logs (`.md` summaries, task notes). Those logs are
self-reported by the same party whose behavior they're evidence of, and they're
editable after the fact with no independent timestamp. Fine for solo debugging;
not good enough once a teammate, client, or auditor needs to trust the log without
trusting the agent's owner.

## Solution
A thin interceptor sits between the agent and its actions. For each action it:
1. Hashes the action type, params, and stated reasoning.
2. Sends those hashes to `AgentActionLog.logAction(...)` on Monad and waits for confirmation before letting the agent continue.
3. Stores the full unhashed record offchain, keyed by the same hashes.

Because Monad finalizes in well under a second, step 2 can be awaited inline without
stalling the agent — that's the part that needs Monad specifically, not any chain.
The dashboard reads the onchain log directly (read-only, no wallet needed), recomputes
each hash from the offchain detail, and stamps every entry VERIFIED MATCH or HASH
MISMATCH.

## Project layout
```
contracts/   Foundry project — AgentActionLog.sol + foundry.toml (Monad preconfigured)
agent/       Node script: the "agent" (5 real actions) + the interceptor middleware
dashboard/   Single-file static dashboard — deploy this as your hosted web demo
```

## 1. Deploy the contract (testnet)

```bash
# from contracts/
curl -L https://foundry.paradigm.xyz | bash && foundryup

# get free testnet MON: https://faucet.monad.xyz

# create a keystore (recommended over a raw private key)
cast wallet import monad-deployer --private-key $(cast wallet new | grep 'Private key:' | awk '{print $3}')

forge create src/AgentActionLog.sol:AgentActionLog \
  --account monad-deployer \
  --broadcast
```
Copy the printed contract address — you need it for `agent/.env` and the dashboard,
and it's a required submission field.

## 2. Verify it (so judges can read the source directly)
```bash
forge verify-contract \
  <contract_address> \
  AgentActionLog \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

## 3. Run the demo agent
```bash
cd agent
npm install
cp .env.example .env
# fill in RPC_URL (already correct), PRIVATE_KEY (same wallet you funded), CONTRACT_ADDRESS
npm run demo
```
This performs 5 real actions (read a file, write a file, call the GitHub API, edit
the file based on the real API result, delete the file), committing each one onchain
as it happens and writing `offchain-log.json` with the full detail.

## 4. View the ledger
Open `dashboard/index.html` (or your hosted URL) with:
```
?contract=<your_contract_address>&agent=demo-coding-agent-1
```
or just edit the `CONFIG` object at the top of the `<script>` tag directly, since
that's simpler for a one-off hackathon deploy. Deploy the `dashboard/` folder as a
static site (Vercel/Netlify/GitHub Pages) — that hosted URL is your submission's
Project URL.
