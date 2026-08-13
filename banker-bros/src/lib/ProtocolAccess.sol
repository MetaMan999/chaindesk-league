// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Small, dependency-free control plane used by this reference implementation.
/// @dev Production deployment requires audit review; upgrades are delayed and explicitly accepted.
abstract contract ProtocolAccess {
    address private immutable _self = address(this);
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 internal constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    mapping(bytes32 => mapping(address => bool)) private _roles;
    bool public paused;
    bool private _initialized;
    uint256 private _entered;
    address public pendingImplementation;
    uint64 public upgradeReadyAt;
    uint64 public upgradeDelay;

    event RoleUpdated(bytes32 indexed role, address indexed account, bool enabled);
    event Paused(address indexed guardian);
    event Unpaused(address indexed admin);
    event UpgradeScheduled(address indexed implementation, uint64 readyAt);
    event Upgraded(address indexed implementation);

    error Unauthorized();
    error AlreadyInitialized();
    error ContractPaused();
    error ReentrantCall();
    error InvalidAddress();
    error UpgradeNotReady();
    error IncompatibleImplementation();

    modifier onlyRole(bytes32 role) {
        if (!_roles[role][msg.sender]) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 2) revert ReentrantCall();
        _entered = 2;
        _;
        _entered = 1;
    }

    function _initializeAccess(address admin, address guardian, uint64 delay) internal {
        if (_initialized) revert AlreadyInitialized();
        if (admin == address(0) || guardian == address(0)) revert InvalidAddress();
        _initialized = true;
        _entered = 1;
        upgradeDelay = delay;
        _roles[DEFAULT_ADMIN_ROLE][admin] = true;
        _roles[GUARDIAN_ROLE][guardian] = true;
        _roles[UPGRADER_ROLE][admin] = true;
        emit RoleUpdated(DEFAULT_ADMIN_ROLE, admin, true);
        emit RoleUpdated(GUARDIAN_ROLE, guardian, true);
        emit RoleUpdated(UPGRADER_ROLE, admin, true);
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function setRole(bytes32 role, address account, bool enabled)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert InvalidAddress();
        _roles[role][account] = enabled;
        emit RoleUpdated(role, account, enabled);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function scheduleUpgrade(address implementation) external onlyRole(UPGRADER_ROLE) {
        if (implementation.code.length == 0) revert InvalidAddress();
        pendingImplementation = implementation;
        upgradeReadyAt = uint64(block.timestamp) + upgradeDelay;
        emit UpgradeScheduled(implementation, upgradeReadyAt);
    }

    function executeUpgrade() external onlyRole(UPGRADER_ROLE) {
        address implementation = pendingImplementation;
        if (
            implementation == address(0) || block.timestamp < upgradeReadyAt
                || implementation.code.length == 0 || implementation == address(this)
        ) revert UpgradeNotReady();
        (bool compatible, bytes memory result) =
            implementation.staticcall(abi.encodeWithSignature("proxiableUUID()"));
        if (
            !compatible || result.length != 32
                || abi.decode(result, (bytes32)) != IMPLEMENTATION_SLOT
        ) revert IncompatibleImplementation();
        pendingImplementation = address(0);
        upgradeReadyAt = 0;
        assembly ("memory-safe") {
            sstore(IMPLEMENTATION_SLOT, implementation)
        }
        emit Upgraded(implementation);
    }

    function proxiableUUID() external view returns (bytes32) {
        if (address(this) != _self) revert IncompatibleImplementation();
        return IMPLEMENTATION_SLOT;
    }
}

abstract contract SafeTransferLib {
    error TransferFailed();

    function _safeTransfer(address token, address to, uint256 amount) internal {
        if (token.code.length == 0) revert TransferFailed();
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        if (token.code.length == 0) revert TransferFailed();
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
