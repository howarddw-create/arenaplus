// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Post2Earn} from "../src/Post2Earn.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CreatePromotionTest is Test {
    Post2Earn post2Earn;
    MockERC20 platformToken;
    address owner = makeAddr("owner");
    address promoter = makeAddr("promoter");
    address extensionWallet = makeAddr("extensionWallet");
    address platformFeeWallet = makeAddr("platformFeeWallet");

    string constant PROMOTER_ARENA_ID = "123";
    string constant CONTENT_URI = "ipfs://content";
    string constant CONTENT = "This is the content";

    function setUp() public {
        vm.startPrank(owner);
        platformToken = new MockERC20();
        post2Earn = new Post2Earn(platformToken, platformFeeWallet);
        post2Earn.setExtensionWallet(extensionWallet);
        vm.stopPrank();

        platformToken.mint(promoter, 1_000_000 ether);
    }

    function _createPromotion(
        uint256 slots,
        uint256 rewardPerSlot,
        uint256 expiresIn
    ) internal returns (uint256 promotionId) {
        uint256 netVault = slots * rewardPerSlot;
        uint256 feePercent = post2Earn.platformPromoteFee();
        uint256 fee = (netVault * feePercent) / (100 - feePercent);
        uint256 grossVault = netVault + fee;

        vm.startPrank(promoter);
        platformToken.approve(address(post2Earn), grossVault);

        promotionId = post2Earn.promotionCount();

        post2Earn.createPromotion(
            platformToken,
            Post2Earn.PromotionType.Comment,
            slots,
            grossVault,
            100, // minFollowers
            block.timestamp + expiresIn,
            "postId123",
            CONTENT_URI,
            CONTENT,
            PROMOTER_ARENA_ID
        );
        vm.stopPrank();
    }

    function test_Fail_GrossVaultTooLow() public {
        uint256 slots = 10;
        uint256 grossVault = 99 ether; // below minimum required gross vault

        vm.startPrank(promoter);
        platformToken.approve(address(post2Earn), grossVault);
        vm.expectRevert("Vault too low");
        post2Earn.createPromotion(
            platformToken,
            Post2Earn.PromotionType.Comment,
            slots,
            grossVault,
            100,
            block.timestamp + 1 days,
            "postId123",
            CONTENT_URI,
            CONTENT,
            PROMOTER_ARENA_ID
        );
        vm.stopPrank();
    }

    function test_Fail_InvalidSlots() public {
        uint256 grossVault = 200 ether;
        vm.startPrank(promoter);
        platformToken.approve(address(post2Earn), grossVault);
        vm.expectRevert("Invalid slots");
        post2Earn.createPromotion(
            platformToken,
            Post2Earn.PromotionType.Comment,
            0,
            grossVault,
            100,
            block.timestamp + 1 days,
            "postId123",
            CONTENT_URI,
            CONTENT,
            PROMOTER_ARENA_ID
        );
        vm.stopPrank();
    }

    function test_CreatePromotion_WithRounding() public {
        uint256 slots = 11;
        uint256 rewardPerSlot = 10.123456789 ether; // Ensures vault is > 100 ether
        _createPromotion(slots, rewardPerSlot, 1 days);
    }

    function test_CreatePromotion_MinVault() public {
        uint256 slots = 1;
        uint256 rewardPerSlot = 100 ether;
        _createPromotion(slots, rewardPerSlot, 1 days);
    }

    function test_CreatePromotion_MaxSlots() public {
        uint256 slots = 100;
        uint256 rewardPerSlot = 1 ether;
        _createPromotion(slots, rewardPerSlot, 1 days);
    }

    function test_ComputedRewardPerSlot_MatchesExpected() public {
        uint256 slots = 8;
        uint256 rewardPerSlot = 12.5 ether;
        uint256 netVault = slots * rewardPerSlot;
        uint256 feePercent = post2Earn.platformPromoteFee();
        uint256 fee = (netVault * feePercent) / (100 - feePercent);
        uint256 grossVault = netVault + fee;

        vm.startPrank(promoter);
        platformToken.approve(address(post2Earn), grossVault);
        uint256 promotionId = post2Earn.promotionCount();
        post2Earn.createPromotion(
            platformToken,
            Post2Earn.PromotionType.Comment,
            slots,
            grossVault,
            100,
            block.timestamp + 1 days,
            "postIdABC",
            CONTENT_URI,
            CONTENT,
            PROMOTER_ARENA_ID
        );
        vm.stopPrank();

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertEq(promo.rewardPerSlot, rewardPerSlot, "Computed reward per slot should match expected");
    }

    function test_FullPromotionLifecycle_WithRounding() public {
        uint256 slots = 13;
        uint256 rewardPerSlot = 10.123456789123456789 ether; // Value with many decimals

        // 1. Create Promotion
        uint256 promotionId = _createPromotion(slots, rewardPerSlot, 1 days);

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        uint256 initialContractBalance = platformToken.balanceOf(address(post2Earn));
        assertEq(initialContractBalance, promo.vaultAmount, "Initial balance should match net vault");

        // 2. Engage with all slots
        for (uint256 i = 0; i < slots; i++) {
            uint256 engagerPrivateKey = i + 1_000; // Unique private key
            address engager = vm.addr(engagerPrivateKey);
            string memory arenaId = string(abi.encodePacked("arenaId", i));
            _engage(promotionId, engagerPrivateKey, engager, arenaId);
        }

        promo = post2Earn.getPromotionDetails(promotionId);
        assertEq(promo.slotsTaken, slots, "All slots should be taken");
        assertFalse(promo.active, "Promotion should be inactive after all slots are taken");

        // 3. Claim rewards for all engagers
        vm.warp(block.timestamp + 2 days); // Expire promotion

        for (uint256 i = 0; i < slots; i++) {
            uint256 engagerPrivateKey = i + 1_000;
            address engager = vm.addr(engagerPrivateKey);
            vm.prank(engager);
            post2Earn.claimReward(promotionId);
        }

        // 4. Assert final balance
        uint256 totalPayout = slots * rewardPerSlot;
        uint256 remainingBalance = initialContractBalance - totalPayout;

        // The remaining balance should be less than the number of slots (to account for 1 wei rounding error per payout)
        assertTrue(remainingBalance < slots, "Dust amount should be minimal");
    }

    function _engage(
        uint256 promotionId,
        uint256 engagerPrivateKey,
        address engagerAddr,
        string memory arenaId
    ) internal {
        string memory twitterUsername = string(abi.encodePacked("user_", arenaId));
        string memory engagementPostId = string(abi.encodePacked("engPost_", arenaId));
        uint256 followerCount = 150;

        bytes32 digest = post2Earn.getHash(promotionId, twitterUsername, engagementPostId, followerCount, engagerAddr, arenaId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(engagerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(extensionWallet);
        post2Earn.engage(promotionId, twitterUsername, engagementPostId, followerCount, engagerAddr, CONTENT, signature, arenaId);
    }
}
