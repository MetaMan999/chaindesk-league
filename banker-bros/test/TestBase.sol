// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function assume(bool) external;
    function warp(uint256) external;
    function roll(uint256) external;
    function deal(address, uint256) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "not equal");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "not equal");
    }

    function assertTrue(bool value) internal pure {
        require(value, "not true");
    }

    function bound(uint256 x, uint256 min, uint256 max) internal pure returns (uint256) {
        require(min <= max, "bad bounds");
        if (x < min || x > max) return min + (x % (max - min + 1));
        return x;
    }
}

abstract contract InvariantTestBase is TestBase {
    address[] internal _targetContracts;

    function targetContract(address target) internal {
        _targetContracts.push(target);
    }

    function targetContracts() external view returns (address[] memory) {
        return _targetContracts;
    }
}
