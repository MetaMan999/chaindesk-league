// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "../lib/Ownable.sol";
import { IRandomnessProvider } from "../BankerWorkFloor.sol";

library VRFV2PlusRequest {
    bytes4 internal constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    function encodeExtraArgs(bool nativePayment) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, ExtraArgsV1(nativePayment));
    }
}

interface IVRFCoordinatorV2Plus {
    function requestRandomWords(VRFV2PlusRequest.RandomWordsRequest calldata request)
        external
        returns (uint256 requestId);
}

interface IRandomnessConsumer {
    function fulfillRandomness(uint256 requestId, uint256 randomWord) external;
}

/// @notice Chainlink VRF v2.5 subscription adapter with a non-reverting storage-only callback.
/// @dev Pin and compare this ABI with the target Chainlink release before a public deployment.
contract ChainlinkVrfV25Adapter is Ownable, IRandomnessProvider {
    error AlreadyConfigured();
    error NotConsumer();
    error OnlyCoordinator();
    error RequestNotReady();

    IVRFCoordinatorV2Plus public immutable coordinator;
    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;
    uint16 public immutable requestConfirmations;
    uint32 public immutable callbackGasLimit;
    bool public immutable nativePayment;
    address public consumer;

    mapping(uint256 => bool) public fulfilled;
    mapping(uint256 => bool) public delivered;
    mapping(uint256 => uint256) public randomWordOf;

    event ConsumerConfigured(address indexed consumer);
    event RandomnessRequested(uint256 indexed requestId, uint256 indexed profileId);
    event RandomnessStored(uint256 indexed requestId);
    event RandomnessDelivered(uint256 indexed requestId);

    constructor(
        address initialOwner,
        IVRFCoordinatorV2Plus coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint16 requestConfirmations_,
        uint32 callbackGasLimit_,
        bool nativePayment_
    ) Ownable(initialOwner) {
        if (address(coordinator_) == address(0) || keyHash_ == bytes32(0)) {
            revert ZeroAddress();
        }
        if (subscriptionId_ == 0 || requestConfirmations_ == 0 || callbackGasLimit_ < 50_000) {
            revert RequestNotReady();
        }
        coordinator = coordinator_;
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        requestConfirmations = requestConfirmations_;
        callbackGasLimit = callbackGasLimit_;
        nativePayment = nativePayment_;
    }

    function setConsumer(address consumer_) external onlyOwner {
        if (consumer != address(0)) revert AlreadyConfigured();
        if (consumer_ == address(0)) revert ZeroAddress();
        consumer = consumer_;
        emit ConsumerConfigured(consumer_);
    }

    function requestRandomness(uint256 profileId) external returns (uint256 requestId) {
        if (msg.sender != consumer) revert NotConsumer();
        requestId = coordinator.requestRandomWords(
            VRFV2PlusRequest.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusRequest.encodeExtraArgs(nativePayment)
            })
        );
        emit RandomnessRequested(requestId, profileId);
    }

    /// @notice Coordinator callback. It only stores the result and therefore has no consumer revert risk.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(coordinator)) revert OnlyCoordinator();
        if (randomWords.length == 0 || fulfilled[requestId]) return;
        fulfilled[requestId] = true;
        randomWordOf[requestId] = randomWords[0];
        emit RandomnessStored(requestId);
    }

    /// @notice Permissionless second-stage delivery; safely retryable if the consumer rejects it.
    function deliver(uint256 requestId) external {
        if (!fulfilled[requestId] || delivered[requestId] || consumer == address(0)) {
            revert RequestNotReady();
        }
        delivered[requestId] = true;
        IRandomnessConsumer(consumer).fulfillRandomness(requestId, randomWordOf[requestId]);
        emit RandomnessDelivered(requestId);
    }
}
