// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC721, IERC6551Account } from "./interfaces/IProtocol.sol";
import { ProtocolAccess } from "./lib/ProtocolAccess.sol";

contract BrokerRegistry is ProtocolAccess {
    struct Broker {
        address account;
        uint64 registeredAt;
        uint32 seasonJoined;
        bool active;
    }

    IERC721 public brokerCollection;
    uint32 public currentSeason;
    mapping(uint256 => Broker) public brokers;

    event BrokerRegistered(
        uint256 indexed brokerId, address indexed account, address indexed owner
    );
    event BrokerStatusChanged(uint256 indexed brokerId, bool active);
    event SeasonChanged(uint32 indexed oldSeason, uint32 indexed newSeason);

    error InvalidTokenBoundAccount();
    error NotBrokerOwner();
    error AlreadyRegistered();
    error UnknownBroker();

    function initialize(
        address admin,
        address guardian,
        address collection,
        uint32 season,
        uint64 upgradeDelaySeconds
    ) external {
        _initializeAccess(admin, guardian, upgradeDelaySeconds);
        if (collection.code.length == 0 || season == 0) revert InvalidAddress();
        brokerCollection = IERC721(collection);
        currentSeason = season;
    }

    function registerBroker(uint256 brokerId, address account) external whenNotPaused {
        if (brokers[brokerId].registeredAt != 0) revert AlreadyRegistered();
        if (brokerCollection.ownerOf(brokerId) != msg.sender) revert NotBrokerOwner();
        if (account.code.length == 0) revert InvalidTokenBoundAccount();

        (uint256 chainId, address collection, uint256 tokenId) = IERC6551Account(account).token();
        if (
            chainId != block.chainid || collection != address(brokerCollection)
                || tokenId != brokerId || IERC6551Account(account).owner() != msg.sender
        ) revert InvalidTokenBoundAccount();

        brokers[brokerId] = Broker({
            account: account,
            registeredAt: uint64(block.timestamp),
            seasonJoined: currentSeason,
            active: true
        });
        emit BrokerRegistered(brokerId, account, msg.sender);
    }

    function refreshAccount(uint256 brokerId, address newAccount) external whenNotPaused {
        Broker storage broker = brokers[brokerId];
        if (broker.registeredAt == 0) revert UnknownBroker();
        if (brokerCollection.ownerOf(brokerId) != msg.sender) revert NotBrokerOwner();
        if (newAccount.code.length == 0) revert InvalidTokenBoundAccount();
        (uint256 chainId, address collection, uint256 tokenId) = IERC6551Account(newAccount).token();
        if (
            chainId != block.chainid || collection != address(brokerCollection)
                || tokenId != brokerId || IERC6551Account(newAccount).owner() != msg.sender
        ) revert InvalidTokenBoundAccount();
        broker.account = newAccount;
        emit BrokerRegistered(brokerId, newAccount, msg.sender);
    }

    function controllerOf(uint256 brokerId) public view returns (address) {
        if (brokers[brokerId].registeredAt == 0) revert UnknownBroker();
        return brokerCollection.ownerOf(brokerId);
    }

    function accountOf(uint256 brokerId) external view returns (address) {
        address account = brokers[brokerId].account;
        if (account == address(0)) revert UnknownBroker();
        return account;
    }

    function isActive(uint256 brokerId) external view returns (bool) {
        return brokers[brokerId].active;
    }

    function setBrokerStatus(uint256 brokerId, bool active) external onlyRole(GUARDIAN_ROLE) {
        if (brokers[brokerId].registeredAt == 0) revert UnknownBroker();
        brokers[brokerId].active = active;
        emit BrokerStatusChanged(brokerId, active);
    }

    function setSeason(uint32 season) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (season <= currentSeason) revert Unauthorized();
        uint32 old = currentSeason;
        currentSeason = season;
        emit SeasonChanged(old, season);
    }
}
