// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4 magicValue);
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC6551Account {
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function owner() external view returns (address);
}

interface IBankerBroAccount is IERC6551Account {
    function execute(address target, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory result);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context)
        external
        view
        returns (bytes4 magicValue);
}

interface IBrokerRegistry {
    function isActive(uint256 brokerId) external view returns (bool);
    function accountOf(uint256 brokerId) external view returns (address);
    function controllerOf(uint256 brokerId) external view returns (address);
}

interface ICommissionAccounting {
    function recordFee(uint256 brokerId, address token, uint256 grossFee) external;
}

interface IReputationEngine {
    function recordRoutedVolume(uint256 brokerId, uint256 normalizedVolume) external;
    function recordLiquidity(uint256 brokerId, uint256 normalizedLiquidity) external;
}

interface ILiquidityAttribution {
    function recordSwap(bytes32 poolId, uint256 brokerId, address token, uint256 volume) external;
    function recordLiquidity(bytes32 poolId, uint256 brokerId, int256 delta) external;
}

interface IRouteAdapter {
    function execute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minimumAmountOut,
        address recipient,
        bytes calldata data
    ) external returns (uint256 amountOut);
}

interface IBrokerRouterPolicy {
    function allowedAdapter(address adapter) external view returns (bool);
}
