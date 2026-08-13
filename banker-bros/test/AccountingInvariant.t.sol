// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { InvariantTestBase } from "./TestBase.sol";
import { BrokerRegistry } from "../src/BrokerRegistry.sol";
import { CommissionAccounting } from "../src/CommissionAccounting.sol";
import { MockNFT, Mock6551, MockERC20 } from "./mocks/Mocks.sol";

contract AccountingHandler {
    CommissionAccounting public immutable accounting;
    MockERC20 public immutable token;
    uint256 public totalRecorded;

    constructor(CommissionAccounting accounting_, MockERC20 token_) {
        accounting = accounting_;
        token = token_;
    }

    function record(uint96 raw) external {
        uint256 amount = uint256(raw) % 1_000_000 ether + 1;
        token.mint(address(accounting), amount);
        accounting.recordFee(1, address(token), amount);
        totalRecorded += amount;
    }
}

contract AccountingInvariantTest is InvariantTestBase {
    CommissionAccounting internal accounting;
    MockERC20 internal token;
    AccountingHandler internal handler;

    function setUp() public {
        MockNFT nft = new MockNFT();
        nft.mint(address(this), 1);
        Mock6551 account = new Mock6551(block.chainid, address(nft), 1);
        BrokerRegistry registry = new BrokerRegistry();
        registry.initialize(address(this), address(this), address(nft), 1, 0);
        registry.registerBroker(1, address(account));
        accounting = new CommissionAccounting();
        accounting.initialize(
            address(this), address(this), address(registry), address(this), 1500, 0
        );
        token = new MockERC20("Token", "TOK");
        handler = new AccountingHandler(accounting, token);
        accounting.setRole(keccak256("RECORDER_ROLE"), address(handler), true);
        targetContract(address(handler));
    }

    function invariant_liabilitiesEqualRecordedFees() public view {
        uint256 liabilities = accounting.brokerClaimable(1, address(token))
            + accounting.treasuryClaimable(address(token));
        assertEq(liabilities, accounting.totalAccounted(address(token)));
        assertEq(token.balanceOf(address(accounting)), accounting.totalAccounted(address(token)));
        assertEq(accounting.totalAccounted(address(token)), handler.totalRecorded());
    }
}
