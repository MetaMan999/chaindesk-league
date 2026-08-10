// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "../lib/Ownable.sol";
import { IRandomnessProvider } from "../BankerWorkFloor.sol";

interface ILocalRandomnessConsumer {
    function fulfillRandomness(uint256 requestId, uint256 randomWord) external;
}

/// @notice Explicitly non-VRF local testing provider. Never deploy this as a public game oracle.
contract LocalRandomnessProvider is Ownable, IRandomnessProvider {
    error AlreadyConfigured();
    error NotConsumer();
    error UnknownRequest();

    address public consumer;
    uint256 public requestCount;
    mapping(uint256 => bool) public pending;

    constructor(address initialOwner) Ownable(initialOwner) { }

    function setConsumer(address consumer_) external onlyOwner {
        if (consumer != address(0)) revert AlreadyConfigured();
        if (consumer_ == address(0)) revert ZeroAddress();
        consumer = consumer_;
    }

    function requestRandomness(uint256) external returns (uint256 requestId) {
        if (msg.sender != consumer) revert NotConsumer();
        requestId = ++requestCount;
        pending[requestId] = true;
    }

    function fulfill(uint256 requestId, uint256 randomWord) external onlyOwner {
        if (!pending[requestId]) revert UnknownRequest();
        pending[requestId] = false;
        ILocalRandomnessConsumer(consumer).fulfillRandomness(requestId, randomWord);
    }
}
