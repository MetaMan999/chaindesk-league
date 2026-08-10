// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IProfileOwner {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface ICommissionGame {
    function claimCommissions(uint256 profileId) external returns (uint256);
}

/// @notice A lightweight onchain desk address controlled by the current profile NFT owner.
/// @dev It deliberately does not expose arbitrary execution in this MVP.
contract BankerDesk {
    error NotProfileOwner();

    ICommissionGame public immutable game;
    IProfileOwner public immutable profile;
    uint256 public immutable profileId;

    constructor(address game_, address profile_, uint256 profileId_) {
        game = ICommissionGame(game_);
        profile = IProfileOwner(profile_);
        profileId = profileId_;
    }

    function owner() public view returns (address) {
        return profile.ownerOf(profileId);
    }

    function claimCommissions() external returns (uint256) {
        if (msg.sender != owner()) revert NotProfileOwner();
        return game.claimCommissions(profileId);
    }
}

