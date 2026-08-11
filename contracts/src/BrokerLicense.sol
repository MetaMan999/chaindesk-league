// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Base64 } from "./lib/Base64.sol";
import { Ownable } from "./lib/Ownable.sol";

interface IBrokerLicenseReceiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

interface IBrokerLicenseRegistryView {
    function brokers(uint256 brokerId)
        external
        view
        returns (
            address tokenBoundAccount,
            address vault,
            uint64 registeredAt,
            uint64 trades,
            uint256 aum,
            uint256 lifetimeVolume,
            uint256 lifetimeCommission,
            uint256 reputation
        );

    function registerBrokerFor(uint256 brokerId, address beneficiary)
        external
        returns (address tokenBoundAccount, address vault);
}

/// @notice Dedicated ERC-721 identity for one Banker Bros brokerage.
/// @dev Public minting is intended for local/testnet onboarding and can be permanently disabled.
contract BrokerLicense is Ownable {
    error AlreadyMinted();
    error CollectionSoldOut();
    error InvalidDeskName();
    error NonexistentToken();
    error NotApproved();
    error PublicMintDisabled();
    error RecipientAlreadyLicensed();
    error UnsafeRecipient();

    string public constant name = "Banker Bros Broker License";
    string public constant symbol = "BBROKER";
    uint256 public constant MAX_SUPPLY = 10_000;

    uint256 public totalSupply;
    bool public publicMintEnabled;
    address public brokerRegistry;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(address => uint256) public licenseOf;
    mapping(address => bool) public hasMinted;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => bytes32) public deskNameOf;
    mapping(uint256 => uint64) public issuedAt;

    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event BrokerRegistrySet(address indexed registry);
    event MetadataUpdate(uint256 indexed tokenId);
    event PublicMintDisabledForever();
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(address initialOwner, bool publicMintEnabled_) Ownable(initialOwner) {
        publicMintEnabled = publicMintEnabled_;
    }

    function ownerOf(uint256 tokenId) public view returns (address tokenOwner) {
        tokenOwner = _ownerOf[tokenId];
        if (tokenOwner == address(0)) revert NonexistentToken();
    }

    function balanceOf(address account) public view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balanceOf[account];
    }

    function mintLicense(bytes32 deskName) external returns (uint256 tokenId) {
        tokenId = _publicMint(msg.sender, deskName);
    }

    function enterWallStreet(bytes32 deskName)
        external
        returns (uint256 tokenId, address tokenBoundAccount, address vault)
    {
        if (brokerRegistry == address(0)) revert ZeroAddress();
        tokenId = _publicMint(msg.sender, deskName);
        (tokenBoundAccount, vault) =
            IBrokerLicenseRegistryView(brokerRegistry).registerBrokerFor(tokenId, msg.sender);
    }

    function ownerMint(address to, bytes32 deskName) external onlyOwner returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (_balanceOf[to] != 0) revert RecipientAlreadyLicensed();
        tokenId = _mint(to, deskName);
    }

    function disablePublicMintForever() external onlyOwner {
        publicMintEnabled = false;
        emit PublicMintDisabledForever();
    }

    function setBrokerRegistry(address registry) external onlyOwner {
        if (registry == address(0)) revert ZeroAddress();
        brokerRegistry = registry;
        emit BrokerRegistrySet(registry);
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
        if (_balanceOf[to] != 0) revert RecipientAlreadyLicensed();
        if (
            msg.sender != tokenOwner && msg.sender != getApproved[tokenId]
                && !isApprovedForAll[tokenOwner][msg.sender]
        ) revert NotApproved();

        delete getApproved[tokenId];
        delete licenseOf[from];
        _balanceOf[from] = 0;
        _balanceOf[to] = 1;
        licenseOf[to] = tokenId;
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
                && IBrokerLicenseReceiver(to).onERC721Received(msg.sender, from, tokenId, data)
                    != IBrokerLicenseReceiver.onERC721Received.selector
        ) revert UnsafeRecipient();
    }

    function bindingOf(uint256 tokenId) public view returns (address account, address vault) {
        ownerOf(tokenId);
        if (brokerRegistry == address(0)) return (address(0), address(0));
        (account, vault,,,,,,) = IBrokerLicenseRegistryView(brokerRegistry).brokers(tokenId);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        (address account, address vault) = bindingOf(tokenId);
        bool bound = account != address(0) && vault != address(0);
        string memory deskName = _bytes32ToString(deskNameOf[tokenId]);
        string memory status = bound ? "ERC-6551 BOUND" : "AWAITING REGISTRATION";
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">',
            '<rect width="640" height="640" fill="#08130d"/><path d="M0 460L640 240V640H0Z" fill="#102b1b"/>',
            '<rect x="24" y="24" width="592" height="592" fill="none" stroke="#d6ad4b" stroke-width="4"/>',
            '<text x="52" y="82" fill="#d6ad4b" font-family="monospace" font-size="22">BANKER BROS // BROKER LICENSE</text>',
            '<text x="52" y="190" fill="#f4e8c3" font-family="sans-serif" font-weight="700" font-size="48">',
            deskName,
            '</text><text x="52" y="242" fill="#8ca391" font-family="monospace" font-size="24">LICENSE #',
            _toString(tokenId),
            '</text><rect x="52" y="310" width="536" height="126" fill="#050b07" stroke="#48644e"/>',
            '<text x="82" y="365" fill="#8ca391" font-family="monospace" font-size="18">ACCOUNT STATUS</text>',
            '<text x="82" y="406" fill="',
            bound ? "#61d685" : "#e0b553",
            '" font-family="monospace" font-size="25" font-weight="700">',
            status,
            '</text><text x="52" y="560" fill="#78907d" font-family="monospace" font-size="17">ROBINHOOD CHAIN COMPATIBLE / ORIGINAL GAME IDENTITY</text></svg>'
        );
        string memory json = string.concat(
            '{"name":"Banker Bros Broker License #',
            _toString(tokenId),
            '","description":"A transferable onchain brokerage identity for the Banker Bros RPG. It is not a security, investment, or promise of returns.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Desk","value":"',
            deskName,
            '"},{"trait_type":"ERC-6551","value":"',
            bound ? "Bound" : "Unbound",
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f
            || interfaceId == 0x49064906;
    }

    function _mint(address to, bytes32 deskName) private returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (!_validDeskName(deskName)) revert InvalidDeskName();
        if (totalSupply >= MAX_SUPPLY) revert CollectionSoldOut();
        tokenId = ++totalSupply;
        _ownerOf[tokenId] = to;
        _balanceOf[to] = 1;
        licenseOf[to] = tokenId;
        deskNameOf[tokenId] = deskName;
        issuedAt[tokenId] = uint64(block.timestamp);
        emit Transfer(address(0), to, tokenId);
    }

    function _publicMint(address to, bytes32 deskName) private returns (uint256 tokenId) {
        if (!publicMintEnabled) revert PublicMintDisabled();
        if (hasMinted[to] || _balanceOf[to] != 0) revert AlreadyMinted();
        hasMinted[to] = true;
        tokenId = _mint(to, deskName);
    }

    function _bytes32ToString(bytes32 value) private pure returns (string memory) {
        uint256 length;
        while (length < 32 && value[length] != 0) ++length;
        bytes memory output = new bytes(length);
        for (uint256 i; i < length; ++i) {
            output[i] = value[i];
        }
        return string(output);
    }

    function _validDeskName(bytes32 value) private pure returns (bool) {
        uint256 length;
        while (length < 32 && value[length] != 0) {
            bytes1 character = value[length];
            bool allowed = (character >= 0x41 && character <= 0x5A)
                || (character >= 0x30 && character <= 0x39) || character == 0x20
                || character == 0x2D || character == 0x2E;
            if (!allowed) return false;
            ++length;
        }
        return length >= 3 && length <= 24;
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        uint256 copy = value;
        while (copy != 0) {
            ++digits;
            copy /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            --digits;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
