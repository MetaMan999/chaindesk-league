// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC721, IERC1271 } from "./interfaces/IProtocol.sol";

/// @notice Owner-controlled token-bound account for one Banker Bros ERC-721.
/// @dev Supports ERC-6551-style token/owner/state/signature/execution surfaces without custody by protocol admins.
contract BankerBroAccount {
    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;
    bytes4 internal constant ERC721_RECEIVED = 0x150b7a02;
    bytes4 internal constant ERC1155_RECEIVED = 0xf23a6e61;
    bytes4 internal constant ERC1155_BATCH_RECEIVED = 0xbc197c81;

    uint256 public immutable tokenChainId;
    address public immutable tokenContract;
    uint256 public immutable tokenId;
    uint256 public state;
    uint256 private _entered = 1;

    event TransactionExecuted(
        address indexed owner,
        address indexed target,
        uint256 value,
        uint8 operation,
        uint256 indexed nonce
    );
    event EtherReceived(address indexed sender, uint256 amount);

    error Unauthorized();
    error UnsupportedOperation();
    error ExecutionFailed(bytes reason);
    error OwnershipCycle();
    error ReentrantCall();
    error InvalidTarget();

    constructor(uint256 chainId_, address tokenContract_, uint256 tokenId_) {
        if (tokenContract_.code.length == 0) revert InvalidTarget();
        tokenChainId = chainId_;
        tokenContract = tokenContract_;
        tokenId = tokenId_;
    }

    modifier onlyTokenOwner() {
        if (msg.sender != owner()) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 2) revert ReentrantCall();
        _entered = 2;
        _;
        _entered = 1;
    }

    receive() external payable {
        emit EtherReceived(msg.sender, msg.value);
    }

    function token() external view returns (uint256, address, uint256) {
        return (tokenChainId, tokenContract, tokenId);
    }

    function owner() public view returns (address tokenOwner) {
        if (block.chainid != tokenChainId) return address(0);
        try IERC721(tokenContract).ownerOf(tokenId) returns (address currentOwner) {
            tokenOwner = currentOwner;
        } catch {
            tokenOwner = address(0);
        }
    }

    /// @param operation Only CALL (0) is supported; delegatecall is deliberately disabled.
    function execute(address target, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        onlyTokenOwner
        nonReentrant
        returns (bytes memory result)
    {
        if (operation != 0) revert UnsupportedOperation();
        if (target == address(0) || target == address(this)) revert InvalidTarget();
        uint256 nonce = ++state;
        (bool ok, bytes memory returned) = target.call{ value: value }(data);
        if (!ok) revert ExecutionFailed(returned);
        emit TransactionExecuted(msg.sender, target, value, operation, nonce);
        return returned;
    }

    function isValidSigner(address signer, bytes calldata)
        external
        view
        returns (bytes4 magicValue)
    {
        return signer == owner() ? this.isValidSigner.selector : bytes4(0);
    }

    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4 magicValue)
    {
        address tokenOwner = owner();
        if (tokenOwner == address(0)) return ERC1271_INVALID;
        if (tokenOwner.code.length != 0) {
            try IERC1271(tokenOwner).isValidSignature(hash, signature) returns (bytes4 value) {
                return value == ERC1271_MAGIC_VALUE ? value : ERC1271_INVALID;
            } catch {
                return ERC1271_INVALID;
            }
        }
        return _recover(hash, signature) == tokenOwner ? ERC1271_MAGIC_VALUE : ERC1271_INVALID;
    }

    function onERC721Received(address, address, uint256 receivedTokenId, bytes calldata)
        external
        view
        returns (bytes4)
    {
        if (msg.sender == tokenContract && receivedTokenId == tokenId) {
            revert OwnershipCycle();
        }
        return ERC721_RECEIVED;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return ERC1155_RECEIVED;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return ERC1155_BATCH_RECEIVED;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x6faff5f1 // ERC-6551 account surface
            || interfaceId == 0x1626ba7e // ERC-1271 selector
            || interfaceId == 0x4e2312e0; // ERC-1155 receiver
    }

    function _recover(bytes32 hash, bytes calldata signature)
        internal
        pure
        returns (address signer)
    {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) {
            return address(0);
        }
        signer = ecrecover(hash, v, r, s);
    }
}
