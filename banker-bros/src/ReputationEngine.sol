// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IBrokerRegistry } from "./interfaces/IProtocol.sol";
import { ProtocolAccess } from "./lib/ProtocolAccess.sol";

contract ReputationEngine is ProtocolAccess {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    IBrokerRegistry public registry;

    struct Progress {
        uint128 xp;
        uint64 routedVolume;
        uint64 liquidityPoints;
        uint32 trades;
        uint16 reputation;
    }

    mapping(uint32 => mapping(uint256 => Progress)) public progress;
    mapping(uint256 => uint256) public seasonXpCap;

    event ProgressRecorded(
        uint32 indexed season, uint256 indexed brokerId, uint256 xp, uint16 reputation
    );
    error InactiveBroker();

    function initialize(address admin, address guardian, address registry_, uint64 delay) external {
        _initializeAccess(admin, guardian, delay);
        if (registry_.code.length == 0) revert InvalidAddress();
        registry = IBrokerRegistry(registry_);
    }

    function recordRoutedVolume(uint256 brokerId, uint256 normalizedVolume)
        external
        onlyRole(RECORDER_ROLE)
        whenNotPaused
    {
        _requireActive(brokerId);
        uint32 season = _season();
        Progress storage p = progress[season][brokerId];
        uint256 volumePoints = _sqrt(normalizedVolume / 1e12);
        uint256 cap = seasonXpCap[brokerId] == 0 ? 1_000_000 : seasonXpCap[brokerId];
        uint256 awarded = volumePoints > cap ? cap : volumePoints;
        p.xp = _add128(p.xp, awarded);
        p.routedVolume = _add64(p.routedVolume, normalizedVolume);
        if (p.trades < type(uint32).max) p.trades += 1;
        p.reputation = _reputation(p);
        emit ProgressRecorded(season, brokerId, p.xp, p.reputation);
    }

    function recordLiquidity(uint256 brokerId, uint256 normalizedLiquidity)
        external
        onlyRole(RECORDER_ROLE)
        whenNotPaused
    {
        _requireActive(brokerId);
        uint32 season = _season();
        Progress storage p = progress[season][brokerId];
        uint256 points = _sqrt(normalizedLiquidity / 1e12);
        p.xp = _add128(p.xp, points);
        p.liquidityPoints = _add64(p.liquidityPoints, points);
        p.reputation = _reputation(p);
        emit ProgressRecorded(season, brokerId, p.xp, p.reputation);
    }

    function tier(uint32 season, uint256 brokerId) external view returns (uint8) {
        uint128 xp = progress[season][brokerId].xp;
        if (xp >= 100_000) return 6;
        if (xp >= 30_000) return 5;
        if (xp >= 10_000) return 4;
        if (xp >= 3_000) return 3;
        if (xp >= 500) return 2;
        if (xp >= 100) return 1;
        return 0;
    }

    function setSeasonXpCap(uint256 brokerId, uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        seasonXpCap[brokerId] = cap;
    }

    function _requireActive(uint256 brokerId) internal view {
        if (!registry.isActive(brokerId)) revert InactiveBroker();
    }

    function _season() internal view returns (uint32 season) {
        (bool ok, bytes memory data) =
            address(registry).staticcall(abi.encodeWithSignature("currentSeason()"));
        if (!ok) revert InactiveBroker();
        season = abi.decode(data, (uint32));
    }

    function _reputation(Progress storage p) internal view returns (uint16) {
        uint256 score = 25 + _sqrt(p.trades) * 2 + _sqrt(p.liquidityPoints);
        return uint16(score > 1000 ? 1000 : score);
    }

    function _sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = 1;
        uint256 y = x;
        if (y >> 128 > 0) {
            y >>= 128;
            z <<= 64;
        }
        if (y >> 64 > 0) {
            y >>= 64;
            z <<= 32;
        }
        if (y >> 32 > 0) {
            y >>= 32;
            z <<= 16;
        }
        if (y >> 16 > 0) {
            y >>= 16;
            z <<= 8;
        }
        if (y >> 8 > 0) {
            y >>= 8;
            z <<= 4;
        }
        if (y >> 4 > 0) {
            y >>= 4;
            z <<= 2;
        }
        if (y >> 2 > 0) z <<= 1;
        for (uint256 i; i < 7; ++i) {
            z = (z + x / z) >> 1;
        }
        uint256 z1 = x / z;
        return z < z1 ? z : z1;
    }

    function _add128(uint128 current, uint256 value) internal pure returns (uint128) {
        uint256 room = type(uint128).max - uint256(current);
        return value >= room ? type(uint128).max : current + uint128(value);
    }

    function _add64(uint64 current, uint256 value) internal pure returns (uint64) {
        uint256 room = type(uint64).max - uint256(current);
        return value >= room ? type(uint64).max : current + uint64(value);
    }
}
