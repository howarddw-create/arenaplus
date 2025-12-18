// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/Post2Earn.sol";
import "./mocks/MockERC20.sol";
import "./mocks/FeeOnTransferERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Post2EarnTest is Test {
    //- Events
    event PromotionCreated(
        uint256 indexed promotionId,
        address indexed promoter,
        string postId,
        uint256 slots,
        uint256 vaultAmount,
        uint256 rewardPerSlot,
        uint256 newPromoterScore,
        string arenaUserId
    );
    event Engaged(uint256 indexed promotionId, address indexed engager, string twitterUsername, uint256 reward);
    event RewardClaimed(
        uint256 indexed promotionId,
        address indexed engager,
        uint256 reward,
        uint256 newEngagerScore,
        string arenaUserId
    );
    event Subscribed(address indexed subscriber, address indexed token, uint256 amount, uint256 expiresOn, string arenaUserId);

    //- Contracts and Tokens
    Post2Earn internal post2Earn;
    MockERC20 internal platformToken;
    MockERC20 internal otherToken;

    //- Users and Wallets
    address internal owner;
    address internal promoter;
    address internal extensionWallet;
    address internal platformFeeWallet;
    uint256 internal engagerPrivateKey;
    address internal engager;
    uint256 internal secondEngagerKey;
    address internal secondEngager;
    uint256 internal deploymentTimestamp;

    //- Constants
    string constant CONTENT_URI = "ipfs://arena-content";
    string constant CONTENT = "Arena promotion content body";
    string constant PROMOTER_ARENA_ID = "promoter-arena-user";
    string constant ENGAGER_ARENA_ID = "engager-arena-user";

    function setUp() public {
        owner = address(this);
        deploymentTimestamp = block.timestamp;
        platformToken = new MockERC20();
        otherToken = new MockERC20();

        promoter = makeAddr("promoter");
        extensionWallet = makeAddr("extensionWallet");
        platformFeeWallet = makeAddr("platformFeeWallet");

        engagerPrivateKey = 0x123456;
        engager = vm.addr(engagerPrivateKey);
        secondEngagerKey = 0x654321;
        secondEngager = vm.addr(secondEngagerKey);

        post2Earn = new Post2Earn(IERC20(address(platformToken)), extensionWallet);
        post2Earn.setPlatformFeeWallet(platformFeeWallet);
        post2Earn.setPlatformPromoteFee(5); // 5%

        platformToken.mint(promoter, 1_000_000 ether);
        otherToken.mint(promoter, 1_000_000 ether);

        vm.deal(promoter, 100 ether); // For subscription fees
    }

    // ============== HELPER FUNCTIONS ============== //

    function _createPromotion(
        IERC20 rewardToken,
        uint256 slots,
        uint256 rewardPerSlot,
        uint256 expiresIn
    ) internal returns (uint256 promotionId) {
        uint256 netVault = slots * rewardPerSlot;
        uint256 feePercent = post2Earn.platformPromoteFee();
        uint256 fee = (netVault * feePercent) / (100 - feePercent);
        uint256 grossVault = netVault + fee;

        vm.startPrank(promoter);
        rewardToken.approve(address(post2Earn), grossVault);

        promotionId = post2Earn.promotionCount();

        post2Earn.createPromotion(
            rewardToken,
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

    function _engage(uint256 promotionId, uint256 pKey, address engagerAddr, string memory arenaId) internal {
        string memory twitterUsername = string(abi.encodePacked("user_", arenaId));
        string memory engagementPostId = string(abi.encodePacked("engPost_", arenaId));
        uint256 followerCount = 150;

        bytes32 digest = post2Earn.getHash(promotionId, twitterUsername, engagementPostId, followerCount, engagerAddr, arenaId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(extensionWallet);
        post2Earn.engage(promotionId, twitterUsername, engagementPostId, followerCount, engagerAddr, CONTENT, signature, arenaId);
    }

    function _engageWithIframe(uint256 promotionId, address engagerAddr, string memory arenaId) internal {
        string memory twitterUsername = string(abi.encodePacked("iframe_user_", arenaId));
        string memory engagementPostId = string(abi.encodePacked("iframe_engPost_", arenaId));
        uint256 followerCount = 150;

        vm.prank(extensionWallet);
        post2Earn.engageWithIframe(promotionId, twitterUsername, engagementPostId, followerCount, engagerAddr, CONTENT, arenaId);
    }

    // ============== CORE FUNCTIONALITY TESTS ============== //

    function test_CreatePromotion() public {
        uint256 slots = 10;
        uint256 rewardPerSlot = 15 ether; // > 100 ether total net vault
        uint256 netVault = slots * rewardPerSlot;

        uint256 promotionId = _createPromotion(platformToken, slots, rewardPerSlot, 1 days);

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertEq(promo.promoter, promoter);
        assertEq(promo.arenaUserId, PROMOTER_ARENA_ID);
        assertEq(promo.vaultAmount, netVault);
        assertEq(address(promo.rewardToken), address(platformToken));
        assertTrue(promo.active);

        assertEq(platformToken.balanceOf(address(post2Earn)), netVault, "Contract balance mismatch");
        assertEq(post2Earn.promoterScores(promoter), netVault, "Promoter score mismatch");
    }

    function test_CreatePromotion_AccountsForFeeOnTransferToken() public {
        FeeOnTransferERC20 feeToken = new FeeOnTransferERC20(1000, makeAddr("feeRecipient")); // 10% transfer fee
        feeToken.mint(promoter, 2_000_000 ether);

        // Subscribe the token first since it's not the platform token
        uint256 subscriptionFee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        post2Earn.subscribe{value: subscriptionFee * 1}(feeToken, "promoter-arena-id", 1);

        uint256 slots = 10;
        uint256 grossVault = 1_000 ether;
        uint256 promotionId = post2Earn.promotionCount();

        vm.startPrank(promoter);
        feeToken.approve(address(post2Earn), grossVault);
        post2Earn.createPromotion(
            feeToken,
            Post2Earn.PromotionType.Comment,
            slots,
            grossVault,
            100,
            block.timestamp + 1 days,
            "post-fee",
            CONTENT_URI,
            CONTENT,
            PROMOTER_ARENA_ID
        );
        vm.stopPrank();

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);

        uint256 platformFee = (grossVault * post2Earn.platformPromoteFee()) / 100;
        uint256 transferAmount = grossVault - platformFee;
        uint256 fotFee = (transferAmount * feeToken.feeBps()) / 10_000;
        uint256 expectedNet = transferAmount - fotFee;

        assertEq(promo.vaultAmount, expectedNet, "Vault amount should equal actual tokens received");
        assertEq(promo.rewardPerSlot, expectedNet / slots, "Reward per slot should use actual net amount");
        assertEq(feeToken.balanceOf(address(post2Earn)), expectedNet, "Contract balance should match net tokens received");
    }

    function test_EngagePromotion() public {
        uint256 rewardPerSlot = 15 ether;
        uint256 promotionId = _createPromotion(platformToken, 10, rewardPerSlot, 1 days);

        vm.expectEmit(true, true, true, true, address(post2Earn));
        emit Engaged(promotionId, engager, string(abi.encodePacked("user_", ENGAGER_ARENA_ID)), rewardPerSlot);

        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertEq(promo.slotsTaken, 1);

        (address returnedEngager, , , , string memory returnedArenaUserId, bool rewarded) = post2Earn.engagementsData(promotionId, engager);
        assertEq(returnedEngager, engager);
        assertEq(returnedArenaUserId, ENGAGER_ARENA_ID);
        assertFalse(rewarded);
    }

    function test_ClaimReward() public {
        uint256 rewardPerSlot = 15 ether;
        uint256 promotionId = _createPromotion(platformToken, 10, rewardPerSlot, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        vm.warp(block.timestamp + 2 days); // Expire the promotion

        uint256 balanceBefore = platformToken.balanceOf(engager);

        vm.prank(engager);
        vm.expectEmit(true, true, true, true, address(post2Earn));
        emit RewardClaimed(promotionId, engager, rewardPerSlot, rewardPerSlot, ENGAGER_ARENA_ID);
        post2Earn.claimReward(promotionId);

        uint256 balanceAfter = platformToken.balanceOf(engager);
        assertEq(balanceAfter - balanceBefore, rewardPerSlot, "Reward not transferred");

        (,,,, , bool rewarded) = post2Earn.engagementsData(promotionId, engager);
        assertTrue(rewarded, "Engagement not marked as rewarded");

        assertEq(post2Earn.engagerScores(engager), rewardPerSlot, "Engager score mismatch");
    }

    function test_PauseBlocksCoreFlows() public {
        uint256 slots = 10;
        uint256 rewardPerSlot = 15 ether;
        uint256 netVault = slots * rewardPerSlot;
        uint256 feePercent = post2Earn.platformPromoteFee();
        uint256 fee = (netVault * feePercent) / (100 - feePercent);
        uint256 grossVault = netVault + fee;

        vm.prank(owner);
        post2Earn.pause();

        vm.startPrank(promoter);
        platformToken.approve(address(post2Earn), grossVault);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        post2Earn.createPromotion(
            platformToken,
            Post2Earn.PromotionType.Comment,
            slots,
            grossVault,
            100,
            block.timestamp + 1 days,
            "paused-post",
            CONTENT_URI,
            CONTENT,
            PROMOTER_ARENA_ID
        );
        vm.stopPrank();

        vm.prank(owner);
        post2Earn.unpause();
        uint256 promotionId = _createPromotion(platformToken, slots, rewardPerSlot, 1 days);

        vm.prank(owner);
        post2Earn.pause();

        vm.prank(extensionWallet);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        post2Earn.engageWithIframe(
            promotionId,
            "pause_user",
            "pause_post",
            150,
            engager,
            CONTENT,
            ENGAGER_ARENA_ID
        );

        vm.prank(owner);
        post2Earn.unpause();
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        vm.warp(block.timestamp + 2 days);

        vm.prank(owner);
        post2Earn.pause();
        vm.prank(engager);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        post2Earn.claimReward(promotionId);

        vm.prank(owner);
        post2Earn.unpause();
        vm.prank(engager);
        post2Earn.claimReward(promotionId);
    }

    // ============== FAILURE AND EDGE CASE TESTS ============== //

    function test_Fail_ClaimReward_NotExpired() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        vm.prank(engager);
        vm.expectRevert("Promotion not expired");
        post2Earn.claimReward(promotionId);
    }

    function test_Fail_ClaimReward_AlreadyClaimed() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);
        vm.warp(block.timestamp + 2 days);

        vm.prank(engager);
        post2Earn.claimReward(promotionId); // First claim

        vm.prank(engager);
        vm.expectRevert("Reward already claimed");
        post2Earn.claimReward(promotionId); // Second claim
    }

    function test_Fail_Engage_InvalidSignature() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        
        // Use correct engager address but wrong private key for signature
        string memory twitterUsername = string(abi.encodePacked("user_", ENGAGER_ARENA_ID));
        string memory engagementPostId = string(abi.encodePacked("engPost_", ENGAGER_ARENA_ID));
        uint256 followerCount = 150;

        bytes32 digest = post2Earn.getHash(promotionId, twitterUsername, engagementPostId, followerCount, engager, ENGAGER_ARENA_ID);
        
        // Sign with wrong private key
        uint256 wrongPrivateKey = 0x999999;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, digest);
        bytes memory wrongSignature = abi.encodePacked(r, s, v);

        vm.prank(extensionWallet);
        vm.expectRevert("Invalid signature");
        post2Earn.engage(promotionId, twitterUsername, engagementPostId, followerCount, engager, CONTENT, wrongSignature, ENGAGER_ARENA_ID);
    }

    function test_Fail_Engage_NotExtensionWallet() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        address randomWallet = makeAddr("random");

        vm.prank(randomWallet);
        vm.expectRevert("Not authorized");
        // We don't use the helper here because it pranks extensionWallet internally
        post2Earn.engage(promotionId, "user", "post", 150, engager, CONTENT, "", ENGAGER_ARENA_ID);
    }

    function test_Fail_Engage_AlreadyEngaged() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID); // First engagement

        // Try to engage again with same user - should fail
        string memory twitterUsername = string(abi.encodePacked("user_", ENGAGER_ARENA_ID));
        string memory engagementPostId = string(abi.encodePacked("engPost_", ENGAGER_ARENA_ID));
        uint256 followerCount = 150;

        bytes32 digest = post2Earn.getHash(promotionId, twitterUsername, engagementPostId, followerCount, engager, ENGAGER_ARENA_ID);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(engagerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(extensionWallet);
        vm.expectRevert("Already engaged");
        post2Earn.engage(promotionId, twitterUsername, engagementPostId, followerCount, engager, CONTENT, signature, ENGAGER_ARENA_ID);
    }

    function test_EngageWithIframe() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        _engageWithIframe(promotionId, engager, ENGAGER_ARENA_ID);

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertEq(promo.slotsTaken, 1);

        (address returnedEngager, , , , , bool rewarded) = post2Earn.engagementsData(promotionId, engager);
        assertEq(returnedEngager, engager);
        assertFalse(rewarded);
    }

    function test_Getters() public {
        uint256 rewardPerSlot = 15 ether;
        uint256 promotionId = _createPromotion(platformToken, 10, rewardPerSlot, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        //- getPromoterCreatedPromotions
        uint256[] memory promoterPromos = post2Earn.getPromoterCreatedPromotions(
            promoter,
            0,
            10,
            true,
            Post2Earn.PromoterPromotionFilter.All
        );
        assertEq(promoterPromos.length, 1);
        assertEq(promoterPromos[0], promotionId);

        //- getPromotionDetails
        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertEq(promo.promoter, promoter);

        //- getPromotionEngagementData
        Post2Earn.Engagement[] memory engagements = post2Earn.getPromotionEngagementData(promotionId);
        assertEq(engagements.length, 1);
        assertEq(engagements[0].engager, engager);

        //- getUnclaimedRewards (before claim)
        uint256[] memory unclaimed = post2Earn.getUnclaimedRewards(engager);
        assertEq(unclaimed.length, 1);
        assertEq(unclaimed[0], promotionId);

        //- isPromotionAvailable
        assertTrue(post2Earn.isPromotionAvailable("postId123"));

        //- Claim reward and test getters again
        vm.warp(block.timestamp + 2 days);
        vm.prank(engager);
        post2Earn.claimReward(promotionId);

        unclaimed = post2Earn.getUnclaimedRewards(engager);
        assertEq(unclaimed.length, 0, "Should have no unclaimed rewards after claiming");

        //- getScore
        assertEq(post2Earn.getScore(promoter, true), 10 * rewardPerSlot, "Promoter score");
        assertEq(post2Earn.getScore(engager, false), rewardPerSlot, "Engager score");
    }

    function test_GetTokenUnusedVault() public {
        uint256 p1 = _createPromotion(platformToken, 10, 15 ether, 1 days);
        _createPromotion(platformToken, 5, 20 ether, 1 days); // p2
        _engage(p1, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        // Fast forward to expire promotions
        vm.warp(block.timestamp + 2 days);

        uint256 expectedUnused = (9 * 15 ether) + (5 * 20 ether);
        assertEq(post2Earn.getTokenUnusedVault(address(platformToken), promoter), expectedUnused);
    }

    function test_GetPromoterCreatedPromotionsFilters() public {
        uint256 cancelId = _createPromotion(platformToken, 10, 15 ether, 3 days);
        uint256 expiredId = _createPromotion(platformToken, 5, 25 ether, 1 hours);

        vm.warp(block.timestamp + 2 hours);

        uint256[] memory cancelPromos = post2Earn.getPromoterCreatedPromotions(
            promoter,
            0,
            5,
            true,
            Post2Earn.PromoterPromotionFilter.CancelAvailable
        );
        assertEq(cancelPromos.length, 1);
        assertEq(cancelPromos[0], cancelId);

        uint256[] memory unusedVaultPromos = post2Earn.getPromoterCreatedPromotions(
            promoter,
            0,
            5,
            false,
            Post2Earn.PromoterPromotionFilter.ExpiredWithUnusedVault
        );
        assertEq(unusedVaultPromos.length, 1);
        assertEq(unusedVaultPromos[0], expiredId);

        vm.prank(promoter);
        post2Earn.withdrawFromExpiredPromotion(expiredId);

        uint256[] memory claimedPromos = post2Earn.getPromoterCreatedPromotions(
            promoter,
            0,
            5,
            true,
            Post2Earn.PromoterPromotionFilter.VaultClaimed
        );
        assertEq(claimedPromos.length, 1);
        assertEq(claimedPromos[0], expiredId);
    }

    function test_GetActiveSubscriptionsIncludesSubscriber() public {
        (address[] memory tokensBefore, , ) = post2Earn.getActiveSubscriptions();
        uint256 beforeLen = tokensBefore.length;

        uint256 fee = post2Earn.subscriptionFee();

        vm.prank(promoter);
        post2Earn.subscribe{value: fee * 1}(IERC20(address(otherToken)), "promoter-arena-id", 1);

        (address[] memory tokens, uint256[] memory ttl, address[] memory subscribers) = post2Earn.getActiveSubscriptions();

        assertEq(tokens.length, beforeLen + 1);
        assertEq(tokens[tokens.length - 1], address(otherToken));
        assertEq(subscribers[subscribers.length - 1], promoter);
        assertGt(ttl[ttl.length - 1], 0);
    }

    function test_DefaultSubscriptionInitialized() public {
        address defaultToken = post2Earn.DEFAULT_SUBSCRIBED_TOKEN();
        uint256 expiry = post2Earn.subscriptions(defaultToken);
        assertEq(expiry, deploymentTimestamp + (5 * 365 days));

        (address[] memory tokens, , address[] memory subscribers) = post2Earn.getActiveSubscriptions();

        bool found;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == defaultToken) {
                assertEq(subscribers[i], owner);
                found = true;
                break;
            }
        }

        assertTrue(found, "Default token subscription missing");
    }

    // ============== WITHDRAWAL & CANCELLATION TESTS ============== //

    function test_WithdrawFromExpiredPromotion() public {
        uint256 slots = 10;
        uint256 rewardPerSlot = 15 ether;
        uint256 promotionId = _createPromotion(platformToken, slots, rewardPerSlot, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        vm.warp(block.timestamp + 2 days);

        uint256 promoterBalanceBefore = platformToken.balanceOf(promoter);

        vm.prank(promoter);
        post2Earn.withdrawFromExpiredPromotion(promotionId);

        uint256 promoterBalanceAfter = platformToken.balanceOf(promoter);
        uint256 expectedRefund = (slots - 1) * rewardPerSlot;
        assertEq(promoterBalanceAfter - promoterBalanceBefore, expectedRefund);

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertFalse(promo.active);
    }

    function test_CancelPromotion() public {
        post2Earn.setCancelPromotionPenaltyFee(25); // 25%
        uint256 slots = 10;
        uint256 rewardPerSlot = 15 ether;
        uint256 promotionId = _createPromotion(platformToken, slots, rewardPerSlot, 1 days);
        _engage(promotionId, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        uint256 promoterBalanceBefore = platformToken.balanceOf(promoter);
        uint256 feeWalletBalanceBefore = platformToken.balanceOf(platformFeeWallet);

        vm.prank(promoter);
        post2Earn.cancelPromotion(promotionId);

        uint256 remainingVault = (slots - 1) * rewardPerSlot;
        uint256 penalty = (remainingVault * 25) / 100;
        uint256 expectedRefund = remainingVault - penalty;

        uint256 promoterBalanceAfter = platformToken.balanceOf(promoter);
        uint256 feeWalletBalanceAfter = platformToken.balanceOf(platformFeeWallet);

        assertEq(promoterBalanceAfter - promoterBalanceBefore, expectedRefund, "Promoter refund incorrect");
        assertEq(feeWalletBalanceAfter - feeWalletBalanceBefore, penalty, "Platform fee incorrect");

        Post2Earn.Promotion memory promo = post2Earn.getPromotionDetails(promotionId);
        assertFalse(promo.active);
    }

    function test_Fail_Withdraw_NotPromoter() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        vm.warp(block.timestamp + 2 days);
        vm.prank(engager);
        vm.expectRevert("Not promoter");
        post2Earn.withdrawFromExpiredPromotion(promotionId);
    }

    function test_Fail_Cancel_NotPromoter() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        vm.prank(engager);
        vm.expectRevert("Not promoter");
        post2Earn.cancelPromotion(promotionId);
    }

    function test_Fail_Withdraw_NotExpired() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        vm.prank(promoter);
        vm.expectRevert("Promotion not expired");
        post2Earn.withdrawFromExpiredPromotion(promotionId);
    }

    function test_Fail_Cancel_Expired() public {
        uint256 promotionId = _createPromotion(platformToken, 10, 15 ether, 1 days);
        vm.warp(block.timestamp + 2 days);
        vm.prank(promoter);
        vm.expectRevert("Promotion has expired");
        post2Earn.cancelPromotion(promotionId);
    }

    // ============== FILTERED GETTER TESTS ============== //

    function test_GetActivePromotions_ByType() public {
        _createPromotion(platformToken, 10, 15 ether, 1 days); // id 0, Comment
        
        // Create second promotion manually with different type
        uint256 netVault = 10 * 15 ether;
        uint256 feePercent = post2Earn.platformPromoteFee();
        uint256 fee = (netVault * feePercent) / (100 - feePercent);
        uint256 grossVault = netVault + fee;
        
        vm.startPrank(promoter);
        platformToken.approve(address(post2Earn), grossVault);
        post2Earn.createPromotion(platformToken, Post2Earn.PromotionType.Repost, 10, grossVault, 100, block.timestamp + 1 days, "p2", "", "", ""); // id 1, Repost
        vm.stopPrank();

        uint256[] memory commentPromos = post2Earn.getActivePromotionsByType(Post2Earn.PromotionType.Comment, 0, 10, true);
        assertEq(commentPromos.length, 1);
        assertEq(commentPromos[0], 0);

        uint256[] memory repostPromos = post2Earn.getActivePromotionsByType(Post2Earn.PromotionType.Repost, 0, 10, true);
        assertEq(repostPromos.length, 1);
        assertEq(repostPromos[0], 1);
    }

    // ============== ADMIN SETTER TESTS ============== //

    function test_Setters_OnlyOwner() public {
        vm.prank(owner);
        post2Earn.setExtensionWallet(makeAddr("newExtension"));
        post2Earn.setPlatformFeeWallet(makeAddr("newFeeWallet"));
        post2Earn.setSubscriptionFee(2 ether);
        post2Earn.setPlatformPromoteFee(10);
        post2Earn.setCancelPromotionPenaltyFee(30);
        post2Earn.setPlatformToken(IERC20(address(new MockERC20())));

        vm.prank(promoter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, promoter));
        post2Earn.setExtensionWallet(address(0));
    }

    // ============== BULK OPERATION TESTS ============== //

    function test_ClaimAllRewards() public {
        uint256 reward1 = 100 ether;
        uint256 reward2 = 120 ether;
        uint256 p1 = _createPromotion(platformToken, 1, reward1, 1 days);
        uint256 p2 = _createPromotion(platformToken, 1, reward2, 2 days);

        _engage(p1, engagerPrivateKey, engager, ENGAGER_ARENA_ID);
        _engage(p2, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        vm.warp(block.timestamp + 3 days);

        uint256 balanceBefore = platformToken.balanceOf(engager);
        vm.prank(engager);
        post2Earn.claimAllRewards(platformToken);
        uint256 balanceAfter = platformToken.balanceOf(engager);

        assertEq(balanceAfter - balanceBefore, reward1 + reward2);
    }

    function test_ClaimAllUnusedVault() public {
        uint256 p1 = _createPromotion(platformToken, 10, 15 ether, 1 days);
        _createPromotion(platformToken, 5, 20 ether, 1 days); // p2
        _engage(p1, engagerPrivateKey, engager, ENGAGER_ARENA_ID);

        vm.warp(block.timestamp + 2 days);

        uint256 promoterBalanceBefore = platformToken.balanceOf(promoter);
        vm.prank(promoter);
        post2Earn.claimAllUnusedVault(platformToken);
        uint256 promoterBalanceAfter = platformToken.balanceOf(promoter);

        uint256 expectedRefund = (9 * 15 ether) + (5 * 20 ether);
        assertEq(promoterBalanceAfter - promoterBalanceBefore, expectedRefund);
}

// ============== SUBSCRIPTION TESTS ============== //

    function test_Subscribe_NewSubscription() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);

        vm.expectEmit(true, true, true, true);
        emit Subscribed(promoter, address(otherToken), fee, block.timestamp + 30 days, "test-arena-id");
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 1);

        uint256 expiry = post2Earn.subscriptions(address(otherToken));
        assertEq(expiry, block.timestamp + 30 days, "Expiry should be 30 days from now");
    }

    function test_Subscribe_RenewSubscription() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 1);
        uint256 initialExpiry = post2Earn.subscriptions(address(otherToken));

        vm.warp(block.timestamp + 15 days);

        uint256 expectedNewExpiry = initialExpiry + 30 days;

        vm.expectEmit(true, true, false, true);
        emit Subscribed(promoter, address(otherToken), fee, expectedNewExpiry, "test-arena-id");
        vm.prank(promoter);
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 1);

        uint256 newExpiry = post2Earn.subscriptions(address(otherToken));
        assertEq(newExpiry, expectedNewExpiry, "Expiry should be extended by 30 days");
    }

    function test_Subscribe_ResubscribeAfterExpiry() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 1);

        vm.warp(block.timestamp + 40 days);

        uint256 expectedNewExpiry = block.timestamp + 30 days;

        vm.expectEmit(true, true, false, true);
        emit Subscribed(promoter, address(otherToken), fee, expectedNewExpiry, "test-arena-id");
        vm.prank(promoter);
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 1);

        uint256 newExpiry = post2Earn.subscriptions(address(otherToken));
        assertEq(newExpiry, expectedNewExpiry, "Expiry should be 30 days from new subscription");
    }

    function test_Fail_Subscribe_InvalidToken() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        vm.expectRevert("Invalid token address");
        post2Earn.subscribe{value: fee}(MockERC20(address(0)), "test-arena-id", 1);
    }

    function test_Fail_Subscribe_PlatformToken() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        vm.expectRevert("Cannot subscribe platform token");
        post2Earn.subscribe{value: fee}(platformToken, "test-arena-id", 1);
    }

    function test_Fail_Subscribe_IncorrectFee() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        vm.expectRevert("Incorrect subscription fee");
        post2Earn.subscribe{value: fee - 1}(otherToken, "test-arena-id", 1);
    }

    function test_Fail_Subscribe_FeeDisabled() public {
        vm.prank(owner);
        post2Earn.setSubscriptionFee(0);

        vm.prank(promoter);
        vm.expectRevert("Subscriptions not enabled");
        post2Earn.subscribe{value: 0}(otherToken, "test-arena-id", 1);
    }

    function test_CreatePromotion_WithSubscribedToken() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 1);
        _createPromotion(otherToken, 10, 15 ether, 1 days);
    }

    function test_Fail_CreatePromotion_TokenNotSubscribed() public {
        uint256 slots = 1;
        uint256 rewardPerSlot = 101 ether;
        uint256 netVault = slots * rewardPerSlot;
        uint256 feePercent = post2Earn.platformPromoteFee();
        uint256 fee = (netVault * feePercent) / (100 - feePercent);
        uint256 grossVault = netVault + fee;

        vm.startPrank(promoter);
        otherToken.approve(address(post2Earn), grossVault);

        vm.expectRevert("Token subscription expired");
        post2Earn.createPromotion(
            otherToken,
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

    function test_Subscribe_MultipleMonths() public {
        uint256 baseFee = post2Earn.subscriptionFee();
        uint256 months = 3;
        uint256 totalFee = baseFee * months;
        
        vm.prank(promoter);
        vm.expectEmit(true, true, true, true);
        emit Subscribed(promoter, address(otherToken), totalFee, block.timestamp + (months * 30 days), "multi-month-test");
        post2Earn.subscribe{value: totalFee}(otherToken, "multi-month-test", months);

        uint256 expiry = post2Earn.subscriptions(address(otherToken));
        assertEq(expiry, block.timestamp + (months * 30 days), "Expiry should be 90 days from now");
    }

    function test_Subscribe_SixMonths() public {
        uint256 baseFee = post2Earn.subscriptionFee();
        uint256 months = 6;
        uint256 totalFee = baseFee * months;
        
        vm.prank(promoter);
        post2Earn.subscribe{value: totalFee}(otherToken, "six-month-test", months);

        uint256 expiry = post2Earn.subscriptions(address(otherToken));
        assertEq(expiry, block.timestamp + (months * 30 days), "Expiry should be 180 days from now");
    }

    function test_Fail_Subscribe_ZeroMonths() public {
        uint256 fee = post2Earn.subscriptionFee();
        vm.prank(promoter);
        vm.expectRevert("Months must be greater than 0");
        post2Earn.subscribe{value: fee}(otherToken, "test-arena-id", 0);
    }

    function test_Fail_Subscribe_IncorrectFeeForMultipleMonths() public {
        uint256 baseFee = post2Earn.subscriptionFee();
        uint256 months = 3;
        uint256 incorrectFee = baseFee * 2; // Paying for 2 months but requesting 3
        
        vm.prank(promoter);
        vm.expectRevert("Incorrect subscription fee");
        post2Earn.subscribe{value: incorrectFee}(otherToken, "test-arena-id", months);
    }
}

