import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import { logAction } from "./interceptor.js";

const ABI = [
  "function logAction(bytes32 agentId, bytes32 actionTypeHash, bytes32 paramsHash, bytes32 reasoningHash) external returns (uint256)",
  "function getActionCount(bytes32 agentId) external view returns (uint256)",
  "event ActionLogged(address indexed owner, bytes32 indexed agentId, uint256 indexed actionIndex, bytes32 actionTypeHash, bytes32 paramsHash, bytes32 reasoningHash, uint64 timestamp)",
];

const AGENT_ID = "demo-coding-agent-1";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env — copy .env.example to .env and fill it in.`);
  return v;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(requireEnv("RPC_URL"));
  const wallet = new ethers.Wallet(requireEnv("PRIVATE_KEY"), provider);
  const contract = new ethers.Contract(requireEnv("CONTRACT_ADDRESS"), ABI, wallet);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Contract: ${await contract.getAddress()}`);
  console.log(`Agent id: ${AGENT_ID}\n`);

  // 1. Read a real file
  const pkg = fs.readFileSync("./package.json", "utf8");
  await logAction(contract, AGENT_ID, {
    type: "read_file",
    params: { path: "./package.json", bytes: pkg.length },
    reasoning: "Inspecting package.json to check dependencies before running the task.",
  });

  // 2. Write a real file
  const note = `Agent run started ${new Date().toISOString()}\n`;
  fs.writeFileSync("./agent-notes.txt", note);
  await logAction(contract, AGENT_ID, {
    type: "write_file",
    params: { path: "./agent-notes.txt", content: note },
    reasoning: "Recording a timestamped note for this run so progress can be tracked.",
  });

  // 3. A real external API call
  const res = await fetch("https://api.github.com/repos/monad-developers/foundry-monad");
  const repo = await res.json();
  await logAction(contract, AGENT_ID, {
    type: "api_call",
    params: { url: "https://api.github.com/repos/monad-developers/foundry-monad", stars: repo.stargazers_count },
    reasoning: "Checking the foundry-monad template's star count as part of research.",
  });

  // 4. Edit the file from step 2, based on the real API result
  const followUp = `Follow-up: foundry-monad has ${repo.stargazers_count} stars.\n`;
  fs.appendFileSync("./agent-notes.txt", followUp);
  await logAction(contract, AGENT_ID, {
    type: "edit_file",
    params: { path: "./agent-notes.txt", appended: followUp.trim() },
    reasoning: "Appending the API result to the notes file for the run summary.",
  });

  // 5. Clean up the temp file
  fs.unlinkSync("./agent-notes.txt");
  await logAction(contract, AGENT_ID, {
    type: "delete_file",
    params: { path: "./agent-notes.txt" },
    reasoning: "Removing the temporary notes file now that the run summary is committed.",
  });

  const count = await contract.getActionCount(ethers.keccak256(ethers.toUtf8Bytes(AGENT_ID)));
  console.log(`\nDone. ${count} actions committed onchain for this agent.`);
  console.log("Full offchain detail written to ./offchain-log.json — open the dashboard to view the verified timeline.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
