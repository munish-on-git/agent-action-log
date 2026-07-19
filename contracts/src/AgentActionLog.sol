// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentActionLog
/// @notice Tamper-evident, per-action commitment log for autonomous AI agents.
///         Every action an agent takes is committed as a set of hashes the moment
///         it happens. The full unhashed detail (params, reasoning) stays offchain;
///         anyone can re-hash that offchain record and compare it to what's stored
///         here to check whether the log was edited after the fact.
contract AgentActionLog {
    struct ActionRecord {
        address owner;
        bytes32 agentId;
        bytes32 actionTypeHash; // keccak256(actionType), e.g. keccak256("write_file")
        bytes32 paramsHash;     // keccak256(JSON.stringify(params))
        bytes32 reasoningHash;  // keccak256(agent's stated reasoning for the action)
        uint64 timestamp;       // block timestamp at commit time
    }

    event ActionLogged(
        address indexed owner,
        bytes32 indexed agentId,
        uint256 indexed actionIndex,
        bytes32 actionTypeHash,
        bytes32 paramsHash,
        bytes32 reasoningHash,
        uint64 timestamp
    );

    mapping(bytes32 => ActionRecord[]) private agentActions;

    /// @notice Commit one agent action. Called inline, per-action, not batched.
    function logAction(
        bytes32 agentId,
        bytes32 actionTypeHash,
        bytes32 paramsHash,
        bytes32 reasoningHash
    ) external returns (uint256 actionIndex) {
        actionIndex = agentActions[agentId].length;

        agentActions[agentId].push(
            ActionRecord({
                owner: msg.sender,
                agentId: agentId,
                actionTypeHash: actionTypeHash,
                paramsHash: paramsHash,
                reasoningHash: reasoningHash,
                timestamp: uint64(block.timestamp)
            })
        );

        emit ActionLogged(
            msg.sender,
            agentId,
            actionIndex,
            actionTypeHash,
            paramsHash,
            reasoningHash,
            uint64(block.timestamp)
        );
    }

    function getAction(bytes32 agentId, uint256 index) external view returns (ActionRecord memory) {
        return agentActions[agentId][index];
    }

    function getActionCount(bytes32 agentId) external view returns (uint256) {
        return agentActions[agentId].length;
    }
}
