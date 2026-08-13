// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC721 } from "./interfaces/IProtocol.sol";
import { BankerBroAccount } from "./BankerBroAccount.sol";

/// @notice Deterministic account factory dedicated to the Banker Bros collection.
contract BankerBroAccountFactory {
    address public immutable collection;
    mapping(uint256 => address) public accountOf;

    event AccountCreated(
        uint256 indexed tokenId, address indexed account, address indexed currentOwner
    );

    error TokenDoesNotExist();

    constructor(address collection_) {
        if (collection_.code.length == 0) revert TokenDoesNotExist();
        collection = collection_;
    }

    function createAccount(uint256 tokenId) external returns (address account) {
        address currentOwner;
        try IERC721(collection).ownerOf(tokenId) returns (address owner_) {
            currentOwner = owner_;
        } catch {
            revert TokenDoesNotExist();
        }
        account = accountOf[tokenId];
        if (account != address(0)) return account;
        bytes32 salt = keccak256(abi.encode(block.chainid, collection, tokenId));
        account = address(new BankerBroAccount{ salt: salt }(block.chainid, collection, tokenId));
        accountOf[tokenId] = account;
        emit AccountCreated(tokenId, account, currentOwner);
    }

    function predictAccount(uint256 tokenId) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encode(block.chainid, collection, tokenId));
        bytes memory creation = abi.encodePacked(
            type(BankerBroAccount).creationCode, abi.encode(block.chainid, collection, tokenId)
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
