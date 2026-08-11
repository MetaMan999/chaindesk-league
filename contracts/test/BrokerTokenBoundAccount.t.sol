// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { BrokerTokenBoundAccount } from "../src/BrokerTokenBoundAccount.sol";

interface VmTokenBound {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes4 revertData) external;
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
}

interface ITestTokenBoundAccount {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory);
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4);
    function owner() external view returns (address);
    function state() external view returns (uint256);
    function token() external view returns (uint256, address, uint256);
}

contract TestLicenseNft {
    mapping(uint256 => address) public ownerOf;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }
}

contract AccountCallTarget {
    uint256 public number;

    function setNumber(uint256 number_) external returns (uint256) {
        number = number_;
        return number_;
    }
}

contract TestAccountProxyFactory {
    function create(address implementation, uint256 chainId, address tokenContract, uint256 tokenId)
        external
        returns (address account)
    {
        bytes memory creationCode = abi.encodePacked(
            hex"3d60ad80600a3d3981f3",
            hex"363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3",
            bytes32(0),
            chainId,
            bytes32(uint256(uint160(tokenContract))),
            tokenId
        );
        assembly ("memory-safe") {
            account := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        if (account == address(0)) revert("proxy deployment failed");
    }
}

contract BrokerTokenBoundAccountTest {
    VmTokenBound private constant vm =
        VmTokenBound(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant TOKEN_ID = 7;

    TestLicenseNft private nft;
    BrokerTokenBoundAccount private implementation;
    ITestTokenBoundAccount private account;
    address private tokenOwner;

    function setUp() public {
        implementation = new BrokerTokenBoundAccount();
        nft = new TestLicenseNft();
        tokenOwner = vm.addr(OWNER_KEY);
        nft.mint(tokenOwner, TOKEN_ID);
        TestAccountProxyFactory factory = new TestAccountProxyFactory();
        address accountAddress =
            factory.create(address(implementation), block.chainid, address(nft), TOKEN_ID);
        account = ITestTokenBoundAccount(accountAddress);
    }

    function testStandardProxyFooterResolvesLicenseOwner() public view {
        (uint256 chainId, address tokenContract, uint256 tokenId) = account.token();
        _assertEq(chainId, block.chainid, "chain id");
        _assertEq(tokenContract, address(nft), "token contract");
        _assertEq(tokenId, TOKEN_ID, "token id");
        _assertEq(account.owner(), tokenOwner, "owner");
    }

    function testLicenseOwnerCanExecuteThroughAccount() public {
        AccountCallTarget target = new AccountCallTarget();
        vm.prank(tokenOwner);
        bytes memory result = account.execute(
            address(target), 0, abi.encodeCall(AccountCallTarget.setNumber, (42)), 0
        );
        _assertEq(abi.decode(result, (uint256)), 42, "return value");
        _assertEq(target.number(), 42, "target state");
        _assertEq(account.state(), 1, "account state");
    }

    function testNonOwnerCannotExecute() public {
        vm.expectRevert(BrokerTokenBoundAccount.NotTokenOwner.selector);
        account.execute(address(this), 0, "", 0);
    }

    function testSelfOwnershipCycleHasNoSigner() public {
        nft.mint(address(account), TOKEN_ID);
        _assertEq(account.owner(), address(0), "cycle guard");
    }

    function testOwnerSignaturePassesErc1271() public {
        bytes32 digest = keccak256("banker-bros-test-signature");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_KEY, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        _assertEq(
            account.isValidSignature(digest, signature), bytes4(0x1626ba7e), "ERC-1271 signature"
        );
    }

    function _assertEq(uint256 actual, uint256 expected, string memory reason) private pure {
        if (actual != expected) revert(reason);
    }

    function _assertEq(address actual, address expected, string memory reason) private pure {
        if (actual != expected) revert(reason);
    }

    function _assertEq(bytes4 actual, bytes4 expected, string memory reason) private pure {
        if (actual != expected) revert(reason);
    }
}
