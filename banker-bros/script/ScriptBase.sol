// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ScriptVm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function envBytes32(string calldata) external returns (bytes32);
    function envString(string calldata) external returns (string memory);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}

abstract contract ScriptBase {
    ScriptVm internal constant vm =
        ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));
}
