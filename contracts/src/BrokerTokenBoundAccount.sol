// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC721AccountOwner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @notice Minimal ERC-6551 account used by each Banker Bros Broker License.
/// @dev The canonical ERC-6551 registry deploys this implementation behind an ERC-1167 proxy and
///      appends salt, chain ID, token contract, and token ID to the proxy runtime bytecode.
contract BrokerTokenBoundAccount {
    error NotTokenOwner();
    error UnsupportedOperation();

    bytes4 private constant ERC1271_VALID_SIGNATURE = 0x1626ba7e;
    bytes4 private constant ERC1271_INVALID_SIGNATURE = 0xffffffff;
    bytes4 private constant ERC6551_ACCOUNT_INTERFACE = 0x6faff5f1;
    uint256 private constant SECP256K1N_DIV_2 =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    uint256 private _state;

    receive() external payable { }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory result)
    {
        if (msg.sender != owner()) revert NotTokenOwner();
        if (operation != 0) revert UnsupportedOperation();
        unchecked {
            ++_state;
        }
        (bool success, bytes memory returnData) = to.call{ value: value }(data);
        if (!success) {
            assembly ("memory-safe") {
                revert(add(returnData, 0x20), mload(returnData))
            }
        }
        return returnData;
    }

    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly ("memory-safe") {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function owner() public view returns (address tokenOwner) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid || tokenContract.code.length == 0) return address(0);
        try IERC721AccountOwner(tokenContract).ownerOf(tokenId) returns (address resolvedOwner) {
            // A license sent to its own account would otherwise create an ownership cycle and
            // permanently lose an externally controlled signer.
            tokenOwner = resolvedOwner == address(this) ? address(0) : resolvedOwner;
        } catch {
            tokenOwner = address(0);
        }
    }

    function state() external view returns (uint256) {
        return _state;
    }

    function isValidSigner(address signer, bytes calldata) external view returns (bytes4) {
        return signer == owner() ? this.isValidSigner.selector : bytes4(0);
    }

    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4)
    {
        if (signature.length != 65) return ERC1271_INVALID_SIGNATURE;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return ERC1271_INVALID_SIGNATURE;
        if (uint256(s) > SECP256K1N_DIV_2) return ERC1271_INVALID_SIGNATURE;
        address signer = ecrecover(hash, v, r, s);
        return signer != address(0) && signer == owner()
            ? ERC1271_VALID_SIGNATURE
            : ERC1271_INVALID_SIGNATURE;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == ERC1271_VALID_SIGNATURE
            || interfaceId == ERC6551_ACCOUNT_INTERFACE || interfaceId == this.execute.selector
            || interfaceId == 0x150b7a02 || interfaceId == 0x4e2312e0;
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
