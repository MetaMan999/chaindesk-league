// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICommissionSink {
    function recordHookVolume(uint256 profileId, address trader, uint256 simulatedNotional) external;
}

