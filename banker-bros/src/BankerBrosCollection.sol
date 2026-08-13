// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Banker Bros: Genesis 222
/// @notice Fixed 222-piece character collection whose owner may control a token-bound broker account.
/// @dev Ownership grants no passive yield, security, brokerage license, or protocol-admin role.
contract BankerBrosCollection {
    string public constant name = "Banker Bros: Genesis 222";
    string public constant symbol = "BBROS";
    uint256 public constant MAX_SUPPLY = 222;
    uint256 public constant COMMUNITY_SUPPLY = 200;
    uint256 public constant TEAM_RESERVE = 22;
    uint96 public constant MAX_ROYALTY_BPS = 1_000;
    uint96 private constant BPS = 10_000;

    enum SalePhase {
        Closed,
        Allowlist,
        Public
    }

    address public owner;
    address public pendingOwner;
    address public payout;
    address public royaltyReceiver;
    uint96 public royaltyBps;
    uint96 public mintPrice;
    uint16 public maxPerWallet;
    uint16 public totalMinted;
    uint16 public communityMinted;
    uint16 public reserveMinted;
    SalePhase public salePhase;
    bool public mintPaused;
    bool public revealed;
    bool public metadataFrozen;
    bytes32 public merkleRoot;
    bytes32 public provenanceHash;
    bytes32 public revealCommitment;
    uint64 public revealCommitBlock;
    uint16 public metadataOffset;
    string public placeholderURI;
    string public baseURI;
    string public contractURI;

    mapping(uint256 => address) private _ownerOf;
    mapping(address => uint256) private _balanceOf;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(address => uint16) public mintedByWallet;
    uint256 private _entered = 1;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event OwnershipTransferStarted(address indexed owner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event SaleConfigured(SalePhase indexed phase, uint96 mintPrice, uint16 maxPerWallet);
    event MintPauseChanged(bool paused);
    event MerkleRootChanged(bytes32 indexed root);
    event ProvenanceCommitted(bytes32 indexed provenanceHash);
    event RevealCommitted(bytes32 indexed commitment, uint64 indexed blockNumber);
    event Revealed(uint16 indexed metadataOffset);
    event MetadataFrozen(string baseURI, string contractURI);
    event RoyaltyConfigured(address indexed receiver, uint96 bps);
    event PayoutChanged(address indexed payout);
    event Withdrawal(address indexed payout, uint256 amount);

    error Unauthorized();
    error InvalidAddress();
    error InvalidQuantity();
    error SoldOut();
    error SaleClosed();
    error WrongPayment();
    error WalletLimit();
    error InvalidProof();
    error TokenDoesNotExist();
    error UnsafeRecipient();
    error MetadataLocked();
    error InvalidReveal();
    error TransferFailed();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_entered == 2) revert ReentrantCall();
        _entered = 2;
        _;
        _entered = 1;
    }

    constructor(
        address initialOwner,
        address payout_,
        address royaltyReceiver_,
        uint96 mintPrice_,
        string memory placeholderURI_,
        string memory contractURI_
    ) {
        if (initialOwner == address(0) || payout_ == address(0) || royaltyReceiver_ == address(0)) revert InvalidAddress();
        owner = initialOwner;
        payout = payout_;
        royaltyReceiver = royaltyReceiver_;
        royaltyBps = 500;
        mintPrice = mintPrice_;
        maxPerWallet = 5;
        placeholderURI = placeholderURI_;
        contractURI = contractURI_;
        emit OwnershipTransferred(address(0), initialOwner);
        emit RoyaltyConfigured(royaltyReceiver_, 500);
    }

    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert InvalidAddress();
        return _balanceOf[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address tokenOwner) {
        tokenOwner = _ownerOf[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist();
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address tokenOwner, address operator) external view returns (bool) {
        return _operatorApprovals[tokenOwner][operator];
    }

    function approve(address approved, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && !_operatorApprovals[tokenOwner][msg.sender]) {
            revert Unauthorized();
        }
        _tokenApprovals[tokenId] = approved;
        emit Approval(tokenOwner, approved, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert Unauthorized();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (to == address(0)) revert InvalidAddress();
        address tokenOwner = ownerOf(tokenId);
        if (tokenOwner != from || !_isAuthorized(tokenOwner, tokenId, msg.sender)) {
            revert Unauthorized();
        }
        delete _tokenApprovals[tokenId];
        unchecked {
            _balanceOf[from] -= 1;
            _balanceOf[to] += 1;
        }
        _ownerOf[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (!_checkOnERC721Received(msg.sender, from, to, tokenId, data)) {
            revert UnsafeRecipient();
        }
    }

    function mint(uint16 quantity, uint16 allowance, bytes32[] calldata proof)
        external
        payable
        nonReentrant
    {
        if (mintPaused) revert SaleClosed();
        if (salePhase == SalePhase.Closed) revert SaleClosed();
        if (quantity == 0) revert InvalidQuantity();
        if (uint256(communityMinted) + quantity > COMMUNITY_SUPPLY) revert SoldOut();
        if (msg.value != uint256(mintPrice) * quantity) revert WrongPayment();

        uint16 walletTotal = mintedByWallet[msg.sender] + quantity;
        if (salePhase == SalePhase.Allowlist) {
            bytes32 leaf = keccak256(abi.encode(msg.sender, allowance));
            if (!_verify(proof, merkleRoot, leaf)) revert InvalidProof();
            if (walletTotal > allowance) revert WalletLimit();
        } else if (walletTotal > maxPerWallet) {
            revert WalletLimit();
        }

        mintedByWallet[msg.sender] = walletTotal;
        communityMinted += quantity;
        _mintBatch(msg.sender, quantity);
    }

    function mintReserve(address to, uint16 quantity) external onlyOwner nonReentrant {
        if (to == address(0) || quantity == 0) revert InvalidQuantity();
        if (uint256(reserveMinted) + quantity > TEAM_RESERVE) revert SoldOut();
        reserveMinted += quantity;
        _mintBatch(to, quantity);
    }

    function configureSale(SalePhase phase, uint96 price, uint16 walletLimit) external onlyOwner {
        if (walletLimit == 0 || walletLimit > 20) revert InvalidQuantity();
        salePhase = phase;
        mintPrice = price;
        maxPerWallet = walletLimit;
        emit SaleConfigured(phase, price, walletLimit);
    }

    function setMintPaused(bool paused_) external onlyOwner {
        mintPaused = paused_;
        emit MintPauseChanged(paused_);
    }

    function setMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
        emit MerkleRootChanged(root);
    }

    function commitProvenance(bytes32 hash) external onlyOwner {
        if (totalMinted != 0 || provenanceHash != bytes32(0) || hash == bytes32(0)) {
            revert MetadataLocked();
        }
        provenanceHash = hash;
        emit ProvenanceCommitted(hash);
    }

    function setMetadataURIs(
        string calldata placeholderURI_,
        string calldata baseURI_,
        string calldata contractURI_
    ) external onlyOwner {
        if (metadataFrozen) revert MetadataLocked();
        placeholderURI = placeholderURI_;
        baseURI = baseURI_;
        contractURI = contractURI_;
    }

    function commitReveal(bytes32 commitment) external onlyOwner {
        if (revealed || commitment == bytes32(0)) revert InvalidReveal();
        if (revealCommitment != bytes32(0) && block.number <= uint256(revealCommitBlock) + 256) {
            revert InvalidReveal();
        }
        revealCommitment = commitment;
        revealCommitBlock = uint64(block.number);
        emit RevealCommitted(commitment, uint64(block.number));
    }

    function reveal(bytes32 secret) external onlyOwner {
        if (
            revealed || keccak256(abi.encode(secret)) != revealCommitment
                || block.number <= revealCommitBlock
                || block.number > uint256(revealCommitBlock) + 256
        ) revert InvalidReveal();
        metadataOffset = uint16(
            uint256(
                keccak256(
                    abi.encode(secret, blockhash(revealCommitBlock), address(this), provenanceHash)
                )
            ) % MAX_SUPPLY
        );
        revealed = true;
        emit Revealed(metadataOffset);
    }

    function freezeMetadata() external onlyOwner {
        if (!revealed || bytes(baseURI).length == 0 || provenanceHash == bytes32(0)) {
            revert InvalidReveal();
        }
        metadataFrozen = true;
        emit MetadataFrozen(baseURI, contractURI);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        if (!revealed) return placeholderURI;
        return string.concat(baseURI, _toString(metadataId(tokenId)), ".json");
    }

    function metadataId(uint256 tokenId) public view returns (uint256) {
        if (tokenId == 0 || tokenId > MAX_SUPPLY) revert TokenDoesNotExist();
        return ((tokenId - 1 + metadataOffset) % MAX_SUPPLY) + 1;
    }

    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        if (receiver == address(0) || bps > MAX_ROYALTY_BPS) revert InvalidQuantity();
        royaltyReceiver = receiver;
        royaltyBps = bps;
        emit RoyaltyConfigured(receiver, bps);
    }

    function royaltyInfo(uint256, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = royaltyReceiver;
        royaltyAmount = salePrice * royaltyBps / BPS;
    }

    function setPayout(address payout_) external onlyOwner {
        if (payout_ == address(0)) revert InvalidAddress();
        payout = payout_;
        emit PayoutChanged(payout_);
    }

    function withdraw() external nonReentrant {
        if (msg.sender != payout && msg.sender != owner) revert Unauthorized();
        uint256 amount = address(this).balance;
        (bool ok,) = payout.call{ value: amount }("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(payout, amount);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidAddress();
        pendingOwner = nextOwner;
        emit OwnershipTransferStarted(owner, nextOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        address oldOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x80ac58cd // ERC-721
            || interfaceId == 0x5b5e139f // ERC-721 metadata
            || interfaceId == 0x2a55205a; // ERC-2981
    }

    function _mintBatch(address to, uint16 quantity) internal {
        if (to == address(0)) revert InvalidAddress();
        uint256 start = uint256(totalMinted) + 1;
        totalMinted += quantity;
        if (totalMinted > MAX_SUPPLY) revert SoldOut();
        _balanceOf[to] += quantity;
        for (uint256 tokenId = start; tokenId < start + quantity; ++tokenId) {
            _ownerOf[tokenId] = to;
            emit Transfer(address(0), to, tokenId);
            if (!_checkOnERC721Received(msg.sender, address(0), to, tokenId, "")) {
                revert UnsafeRecipient();
            }
        }
    }

    function _isAuthorized(address tokenOwner, uint256 tokenId, address operator)
        internal
        view
        returns (bool)
    {
        return operator == tokenOwner || _tokenApprovals[tokenId] == operator
            || _operatorApprovals[tokenOwner][operator];
    }

    function _checkOnERC721Received(
        address operator,
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal returns (bool) {
        if (to.code.length == 0) return true;
        (bool ok, bytes memory result) =
            to.call(abi.encodeWithSelector(0x150b7a02, operator, from, tokenId, data));
        return ok && result.length == 32 && abi.decode(result, (bytes4)) == 0x150b7a02;
    }

    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf)
        internal
        pure
        returns (bool)
    {
        bytes32 computed = leaf;
        for (uint256 i; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            computed = computed <= sibling
                ? keccak256(abi.encodePacked(computed, sibling))
                : keccak256(abi.encodePacked(sibling, computed));
        }
        return computed == root;
    }

    function _toString(uint256 value) internal pure returns (string memory result) {
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
        result = string(buffer);
    }
}
