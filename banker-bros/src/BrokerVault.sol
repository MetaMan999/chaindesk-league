// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IBrokerRegistry, IBrokerRouterPolicy } from "./interfaces/IProtocol.sol";
import { SafeTransferLib } from "./lib/ProtocolAccess.sol";

contract BrokerVault is SafeTransferLib {
    IBrokerRegistry public immutable registry;
    uint256 public immutable brokerId;
    address public immutable router;

    event Deposited(address indexed token, address indexed from, uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event StrategyTransfer(address indexed token, address indexed target, uint256 amount);

    error Unauthorized();
    error InvalidTarget();

    constructor(address registry_, uint256 brokerId_, address router_) {
        if (registry_ == address(0) || router_ == address(0)) revert InvalidTarget();
        registry = IBrokerRegistry(registry_);
        brokerId = brokerId_;
        router = router_;
    }

    function deposit(address token, uint256 amount) external {
        _safeTransferFrom(token, msg.sender, address(this), amount);
        emit Deposited(token, msg.sender, amount);
    }

    function withdraw(address token, address to, uint256 amount) external {
        if (msg.sender != registry.accountOf(brokerId)) revert Unauthorized();
        _safeTransfer(token, to, amount);
        emit Withdrawn(token, to, amount);
    }

    /// @notice Router may move funds only into an admin-allowlisted adapter.
    function transferToStrategy(address token, address target, uint256 amount) external {
        if (msg.sender != router) revert Unauthorized();
        if (target == address(0) || !IBrokerRouterPolicy(router).allowedAdapter(target)) {
            revert InvalidTarget();
        }
        _safeTransfer(token, target, amount);
        emit StrategyTransfer(token, target, amount);
    }
}
