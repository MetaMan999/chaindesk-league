// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IBrokerRegistry } from "./interfaces/IProtocol.sol";
import { ProtocolAccess } from "./lib/ProtocolAccess.sol";
import { BrokerVault } from "./BrokerVault.sol";

contract BrokerVaultFactory is ProtocolAccess {
    IBrokerRegistry public registry;
    address public router;
    mapping(uint256 => address) public vaultOf;

    event VaultCreated(uint256 indexed brokerId, address indexed vault, address indexed account);
    error InactiveBroker();
    error VaultExists();

    function initialize(
        address admin,
        address guardian,
        address registry_,
        address router_,
        uint64 upgradeDelaySeconds
    ) external {
        _initializeAccess(admin, guardian, upgradeDelaySeconds);
        if (registry_.code.length == 0 || router_ == address(0)) revert InvalidAddress();
        registry = IBrokerRegistry(registry_);
        router = router_;
    }

    function createVault(uint256 brokerId) external whenNotPaused returns (address vault) {
        if (!registry.isActive(brokerId)) revert InactiveBroker();
        if (vaultOf[brokerId] != address(0)) revert VaultExists();
        if (registry.controllerOf(brokerId) != msg.sender) revert Unauthorized();
        bytes32 salt = keccak256(abi.encode(block.chainid, brokerId));
        vault = address(new BrokerVault{ salt: salt }(address(registry), brokerId, router));
        vaultOf[brokerId] = vault;
        emit VaultCreated(brokerId, vault, registry.accountOf(brokerId));
    }

    function predictVault(uint256 brokerId) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encode(block.chainid, brokerId));
        bytes memory creation = abi.encodePacked(
            type(BrokerVault).creationCode, abi.encode(address(registry), brokerId, router)
        );
        predicted = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(creation))
                    )
                )
            )
        );
    }
}
