import { ethers } from "ethers";
import fs from "fs";

const OFFCHAIN_LOG_PATH = "./offchain-log.json";

function keccak(str) {
  return ethers.keccak256(ethers.toUtf8Bytes(str));
}

function appendOffchain(record) {
  let log = [];
  if (fs.existsSync(OFFCHAIN_LOG_PATH)) {
    log = JSON.parse(fs.readFileSync(OFFCHAIN_LOG_PATH, "utf8"));
  }
  log.push(record);
  fs.writeFileSync(OFFCHAIN_LOG_PATH, JSON.stringify(log, null, 2));
}

/**
 * Wraps a single agent action: hashes it, commits the hashes onchain
 * inline (awaited, not batched), then stores the full unhashed record
 * offchain keyed by the same hashes so it can be checked later.
 *
 * @param {ethers.Contract} contract  connected AgentActionLog contract (signer attached)
 * @param {string} agentIdStr         human-readable agent id, e.g. "demo-coding-agent-1"
 * @param {{type: string, params: object, reasoning: string}} action
 */
export async function logAction(contract, agentIdStr, action) {
  const agentId = keccak(agentIdStr);
  const actionTypeHash = keccak(action.type);
  const paramsHash = keccak(JSON.stringify(action.params));
  const reasoningHash = keccak(action.reasoning);

  console.log(`\n[interceptor] committing "${action.type}" onchain...`);
  const tx = await contract.logAction(agentId, actionTypeHash, paramsHash, reasoningHash);
  const receipt = await tx.wait();

  const record = {
    agent: agentIdStr,
    type: action.type,
    params: action.params,
    reasoning: action.reasoning,
    hashes: { agentId, actionTypeHash, paramsHash, reasoningHash },
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    committedAt: new Date().toISOString(),
  };
  appendOffchain(record);

  console.log(`[interceptor] confirmed: tx ${receipt.hash} (block ${receipt.blockNumber})`);
  return record;
}
