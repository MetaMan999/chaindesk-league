// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Base64 } from "./lib/Base64.sol";
import { Ownable } from "./lib/Ownable.sol";

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/// @notice Dynamic access identity for the ChainDesk League simulation.
/// @dev This intentionally uses the standard ERC-721 ownership model instead of experimental ERC-404
///      mechanics. Game performance updates the fully onchain metadata.
contract BankerProfile is Ownable {
    error AlreadyConfigured();
    error InvalidHandle();
    error HandleTaken();
    error NonexistentToken();
    error NotApproved();
    error NotGame();
    error InvalidTowerPosition();
    error UnsafeRecipient();
    error CollectionSoldOut();

    string public constant name = "ChainDesk Banker";
    string public constant symbol = "BANKER";
    uint256 public constant MAX_SUPPLY = 1_000;

    struct Stats {
        uint128 volume;
        uint96 commissions;
        uint32 xp;
        uint32 bestSeasonScore;
        uint16 achievements;
        uint16 seasonMedals;
        uint16 latestSeason;
    }

    address public game;
    uint256 public totalSupply;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokenIndex;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => bytes32) public handleOf;
    mapping(bytes32 => bool) public handleTaken;
    mapping(uint256 => Stats) public statsOf;
    mapping(uint256 => uint64) public transferNonce;
    mapping(uint256 => uint8) public towerFloorOf;
    mapping(uint256 => uint16) public latestTowerRankOf;
    mapping(uint256 => uint64) public latestTowerSeasonOf;
    mapping(uint256 => uint16) public officeRatingOf;

    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event GameConfigured(address indexed game);
    event ProfileUpdated(uint256 indexed tokenId, uint256 volume, uint256 commission, uint256 xp);
    event AchievementRecorded(uint256 indexed tokenId, uint256 totalAchievements);
    event SeasonResultRecorded(
        uint256 indexed tokenId, uint256 indexed seasonId, uint256 score, uint8 rank
    );
    event TowerPositionUpdated(
        uint256 indexed tokenId, uint8 floor, uint16 rank, uint64 indexed seasonId
    );
    event OfficeRatingUpdated(uint256 indexed tokenId, uint16 rating);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    /// @notice EIP-4906 signal for wallets and marketplaces to refresh dynamic metadata.
    event MetadataUpdate(uint256 indexed tokenId);

    constructor(address initialOwner) Ownable(initialOwner) { }

    modifier onlyGame() {
        if (msg.sender != game) revert NotGame();
        _;
    }

    function setGame(address game_) external onlyOwner {
        if (game != address(0)) revert AlreadyConfigured();
        if (game_ == address(0)) revert ZeroAddress();
        game = game_;
        emit GameConfigured(game_);
    }

    function ownerOf(uint256 tokenId) public view returns (address tokenOwner) {
        tokenOwner = _ownerOf[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken();
    }

    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balanceOf[account];
    }

    function mint(address to, bytes32 handle) external onlyGame returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (!_validHandle(handle)) revert InvalidHandle();
        if (handleTaken[handle]) revert HandleTaken();
        if (totalSupply >= MAX_SUPPLY) revert CollectionSoldOut();

        tokenId = ++totalSupply;
        _ownerOf[tokenId] = to;
        _balanceOf[to]++;
        _ownedTokenIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        handleOf[tokenId] = handle;
        handleTaken[handle] = true;
        towerFloorOf[tokenId] = 1;
        emit Transfer(address(0), to, tokenId);
    }

    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply;
    }

    function tokensOfOwner(address account) external view returns (uint256[] memory) {
        if (account == address(0)) revert ZeroAddress();
        return _ownedTokens[account];
    }

    function tokenOfOwnerByIndex(address account, uint256 index) external view returns (uint256) {
        return _ownedTokens[account][index];
    }

    function tokenByIndex(uint256 index) external view returns (uint256) {
        if (index >= totalSupply) revert NonexistentToken();
        return index + 1;
    }

    function approve(address spender, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && !isApprovedForAll[tokenOwner][msg.sender]) {
            revert NotApproved();
        }
        getApproved[tokenId] = spender;
        emit Approval(tokenOwner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        address tokenOwner = ownerOf(tokenId);
        if (tokenOwner != from) revert NotApproved();
        if (to == address(0)) revert ZeroAddress();
        if (
            msg.sender != tokenOwner && msg.sender != getApproved[tokenId]
                && !isApprovedForAll[tokenOwner][msg.sender]
        ) revert NotApproved();

        delete getApproved[tokenId];
        unchecked {
            _balanceOf[from]--;
            _balanceOf[to]++;
            transferNonce[tokenId]++;
        }
        _removeOwnedToken(from, tokenId);
        _ownedTokenIndex[tokenId] = _ownedTokens[to].length;
        _ownedTokens[to].push(tokenId);
        _ownerOf[tokenId] = to;
        emit Transfer(from, to, tokenId);
        emit MetadataUpdate(tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (
            to.code.length != 0
                && IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data)
                    != IERC721Receiver.onERC721Received.selector
        ) revert UnsafeRecipient();
    }

    function recordPerformance(uint256 tokenId, uint256 volume, uint256 commission)
        external
        onlyGame
    {
        ownerOf(tokenId);
        Stats storage stats = statsOf[tokenId];
        stats.volume += uint128(volume);
        stats.commissions += uint96(commission);
        uint256 earnedXp = commission / 10 + volume / 10_000;
        uint256 nextXp = uint256(stats.xp) + earnedXp;
        stats.xp = uint32(nextXp > type(uint32).max ? type(uint32).max : nextXp);
        emit ProfileUpdated(tokenId, volume, commission, earnedXp);
        emit MetadataUpdate(tokenId);
    }

    function levelOf(uint256 tokenId) public view returns (uint256) {
        ownerOf(tokenId);
        uint256 level = 1 + uint256(statsOf[tokenId].xp) / 2_500;
        return level > 10 ? 10 : level;
    }

    function recordAchievement(uint256 tokenId) external onlyGame {
        ownerOf(tokenId);
        statsOf[tokenId].achievements++;
        emit AchievementRecorded(tokenId, statsOf[tokenId].achievements);
        emit MetadataUpdate(tokenId);
    }

    function recordSeasonResult(uint256 tokenId, uint256 seasonId, uint256 score, uint8 rank)
        external
        onlyGame
    {
        ownerOf(tokenId);
        Stats storage stats = statsOf[tokenId];
        stats.latestSeason = uint16(seasonId);
        stats.seasonMedals += uint16(4 - rank);
        if (score > stats.bestSeasonScore) {
            stats.bestSeasonScore = uint32(score > type(uint32).max ? type(uint32).max : score);
        }
        emit SeasonResultRecorded(tokenId, seasonId, score, rank);
        emit MetadataUpdate(tokenId);
    }

    function scoreOf(uint256 tokenId) external view returns (uint256) {
        Stats memory stats = statsOf[tokenId];
        return uint256(stats.commissions) + uint256(stats.volume) / 100;
    }

    function recordTowerPosition(uint256 tokenId, uint8 floor, uint16 rank, uint64 seasonId)
        external
        onlyGame
    {
        ownerOf(tokenId);
        if (floor == 0 || floor > 100) revert InvalidTowerPosition();
        towerFloorOf[tokenId] = floor;
        latestTowerRankOf[tokenId] = rank;
        latestTowerSeasonOf[tokenId] = seasonId;
        emit TowerPositionUpdated(tokenId, floor, rank, seasonId);
        emit MetadataUpdate(tokenId);
    }

    function recordOfficeRating(uint256 tokenId, uint16 rating) external onlyGame {
        ownerOf(tokenId);
        officeRatingOf[tokenId] = rating;
        emit OfficeRatingUpdated(tokenId, rating);
        emit MetadataUpdate(tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        Stats memory stats = statsOf[tokenId];
        string memory handle = _bytes32ToString(handleOf[tokenId]);
        string memory level = _toString(levelOf(tokenId));
        string memory xp = _toString(stats.xp);
        string memory volume = _toString(stats.volume);
        string memory achievements = _toString(stats.achievements);
        string memory medals = _toString(stats.seasonMedals);
        string memory walletTransfers = _toString(transferNonce[tokenId]);
        string memory towerFloor = _toString(towerFloorOf[tokenId]);
        string memory towerRank = latestTowerRankOf[tokenId] == 0
            ? string("UNRANKED")
            : _toString(latestTowerRankOf[tokenId]);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">',
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#102018"/><stop offset="1" stop-color="#030805"/></linearGradient></defs>',
            '<rect width="640" height="640" fill="url(#g)"/><rect x="22" y="22" width="596" height="596" fill="none" stroke="#d39b39" stroke-width="3"/>',
            '<text x="52" y="82" fill="#ffc24b" font-family="monospace" font-size="22">CHAINDESK TOWER // PRIVATE WIRE</text>',
            '<text x="52" y="186" fill="white" font-family="sans-serif" font-weight="700" font-size="54">',
            handle,
            '</text><text x="52" y="235" fill="#9aa7c4" font-family="monospace" font-size="24">BANKER #',
            _toString(tokenId),
            '</text><rect x="52" y="300" width="536" height="190" rx="26" fill="#ffffff" opacity=".06"/>',
            '<text x="86" y="360" fill="#9aa7c4" font-family="monospace" font-size="19">FLOOR</text>',
            '<text x="86" y="410" fill="#62ff85" font-family="monospace" font-size="50" font-weight="700">',
            towerFloor,
            '</text><text x="260" y="360" fill="#9aa7c4" font-family="monospace" font-size="19">TOWER RANK</text>',
            '<text x="260" y="410" fill="#ffc24b" font-family="monospace" font-size="34" font-weight="700">',
            towerRank,
            '</text><text x="86" y="464" fill="#9aa7c4" font-family="monospace" font-size="17">LEVEL ',
            level,
            "  XP ",
            xp,
            "  OFFICE ",
            _toString(officeRatingOf[tokenId]),
            '</text><text x="86" y="520" fill="#62ff85" font-family="monospace" font-size="18">SIMULATED VOLUME ',
            volume,
            '</text><text x="86" y="554" fill="#ffc24b" font-family="monospace" font-size="17">MEDALS ',
            medals,
            "  ACHIEVEMENTS ",
            achievements,
            '</text><text x="86" y="582" fill="#9aa7c4" font-family="monospace" font-size="14">WALLET TRANSFERS ',
            walletTransfers,
            '</text><text x="52" y="614" fill="#687594" font-family="monospace" font-size="14">TESTNET GAME - NO EQUITY - NO REAL SECURITIES</text></svg>'
        );

        string memory json = string.concat(
            '{"name":"ChainDesk Banker #',
            _toString(tokenId),
            " - ",
            handle,
            '","description":"A dynamic testnet game identity. It represents no equity, security, revenue right, or claim on real assets.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Level","value":',
            level,
            '},{"trait_type":"XP","value":',
            xp,
            '},{"trait_type":"Simulated Volume","value":',
            volume,
            '},{"trait_type":"Season Medals","value":',
            medals,
            '},{"trait_type":"Read-Only Achievements","value":',
            achievements,
            '},{"trait_type":"Tower Floor","value":',
            towerFloor,
            '},{"trait_type":"Latest Tower Rank","value":"',
            towerRank,
            '"},{"trait_type":"Tower Season","value":',
            _toString(latestTowerSeasonOf[tokenId]),
            '},{"trait_type":"Office Rating","value":',
            _toString(officeRatingOf[tokenId]),
            '},{"trait_type":"Wallet Transfers","value":',
            walletTransfers,
            '},{"trait_type":"Collection Size","value":1000',
            "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f
            || interfaceId == 0x780e9d63 || interfaceId == 0x49064906;
    }

    function _removeOwnedToken(address account, uint256 tokenId) internal {
        uint256 tokenIndex = _ownedTokenIndex[tokenId];
        uint256 lastIndex = _ownedTokens[account].length - 1;
        if (tokenIndex != lastIndex) {
            uint256 lastTokenId = _ownedTokens[account][lastIndex];
            _ownedTokens[account][tokenIndex] = lastTokenId;
            _ownedTokenIndex[lastTokenId] = tokenIndex;
        }
        _ownedTokens[account].pop();
        delete _ownedTokenIndex[tokenId];
    }

    function _validHandle(bytes32 handle) internal pure returns (bool) {
        bool seenNull;
        uint256 length;
        for (uint256 i; i < 32; i++) {
            uint8 char = uint8(handle[i]);
            if (char == 0) {
                seenNull = true;
                continue;
            }
            if (seenNull) return false;
            bool valid = (char >= 48 && char <= 57) || (char >= 65 && char <= 90)
                || (char >= 97 && char <= 122) || char == 45 || char == 95;
            if (!valid) return false;
            length++;
        }
        return length >= 3;
    }

    function _bytes32ToString(bytes32 value) internal pure returns (string memory) {
        uint256 length;
        while (length < 32 && value[length] != 0) length++;
        bytes memory output = new bytes(length);
        for (uint256 i; i < length; i++) {
            output[i] = value[i];
        }
        return string(output);
    }

    function _toString(uint256 value) internal pure returns (string memory str) {
        if (value == 0) return "0";
        uint256 digits;
        uint256 temp = value;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        str = string(buffer);
    }
}
