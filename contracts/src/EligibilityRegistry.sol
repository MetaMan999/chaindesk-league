// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "./lib/Ownable.sol";

/// @notice Partner-attested eligibility for read-only achievements.
/// @dev This registry does not perform identity checks itself. A qualified provider must attest them.
contract EligibilityRegistry is Ownable {
    error NotAttestor();

    mapping(address => bool) public attestors;
    mapping(bytes32 => mapping(address => uint64)) public eligibleUntil;

    event AttestorSet(address indexed attestor, bool allowed);
    event EligibilityAttested(
        bytes32 indexed programId, address indexed account, uint64 validUntil
    );

    constructor(address initialOwner) Ownable(initialOwner) { }

    function setAttestor(address attestor, bool allowed) external onlyOwner {
        attestors[attestor] = allowed;
        emit AttestorSet(attestor, allowed);
    }

    function attest(bytes32 programId, address account, uint64 validUntil) external {
        if (!attestors[msg.sender]) revert NotAttestor();
        eligibleUntil[programId][account] = validUntil;
        emit EligibilityAttested(programId, account, validUntil);
    }

    function isEligible(bytes32 programId, address account) external view returns (bool) {
        return eligibleUntil[programId][account] >= block.timestamp;
    }
}

