// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Post2Earn} from "../src/Post2Earn.sol";

/// @notice Deploys Post2Earn and optionally configures fee parameters using env vars.
contract DeployPost2Earn is Script {
    struct DeployConfig {
        address platformToken;
        address extensionWallet;
        address platformFeeWallet;
        bool hasCustomFeeWallet;
        uint256 platformPromoteFee;
        uint256 cancelPromotionPenaltyFee;
        uint256 subscriptionFee;
        bool pauseOnDeploy;
    }

    function run() external returns (Post2Earn post2Earn) {
        DeployConfig memory cfg = _loadConfig();

        vm.startBroadcast();

        post2Earn = new Post2Earn(IERC20(cfg.platformToken), cfg.extensionWallet);

        if (cfg.hasCustomFeeWallet && cfg.platformFeeWallet != address(0)) {
            post2Earn.setPlatformFeeWallet(cfg.platformFeeWallet);
        }

        if (cfg.platformPromoteFee != post2Earn.platformPromoteFee()) {
            post2Earn.setPlatformPromoteFee(cfg.platformPromoteFee);
        }

        if (cfg.cancelPromotionPenaltyFee != post2Earn.cancelPromotionPenaltyFee()) {
            post2Earn.setCancelPromotionPenaltyFee(cfg.cancelPromotionPenaltyFee);
        }

        if (cfg.subscriptionFee != post2Earn.subscriptionFee()) {
            post2Earn.setSubscriptionFee(cfg.subscriptionFee);
        }

        if (cfg.pauseOnDeploy) {
            post2Earn.pause();
        }

        vm.stopBroadcast();
    }

    function _loadConfig() internal returns (DeployConfig memory cfg) {
        cfg.platformToken = vm.envAddress("REWARD_TOKEN_ADDRESS");
        require(cfg.platformToken != address(0), "REWARD_TOKEN_ADDRESS not set");

        cfg.extensionWallet = vm.envAddress("EXTENSION_WALLET_ADDRESS");
        require(cfg.extensionWallet != address(0), "EXTENSION_WALLET_ADDRESS not set");

        (cfg.platformFeeWallet, cfg.hasCustomFeeWallet) = _envOptionalAddress("PLATFORM_FEE_WALLET");

        cfg.platformPromoteFee = _envOrUint("PLATFORM_PROMOTE_FEE", 5);
        require(cfg.platformPromoteFee <= 100, "Promote fee > 100%");

        cfg.cancelPromotionPenaltyFee = _envOrUint("CANCEL_PROMOTION_PENALTY_FEE", 25);
        require(cfg.cancelPromotionPenaltyFee <= 100, "Cancel fee > 100%");

        cfg.subscriptionFee = _envOrUint("SUBSCRIPTION_FEE_WEI", 1 ether);

        cfg.pauseOnDeploy = _envOrBool("PAUSE_ON_DEPLOY", false);
    }

    function _envOptionalAddress(string memory key) internal returns (address value, bool exists) {
        try vm.envAddress(key) returns (address addr) {
            if (addr != address(0)) {
                value = addr;
                exists = true;
            }
        } catch {}
    }

    function _envOrUint(string memory key, uint256 defaultValue) internal returns (uint256) {
        try vm.envUint(key) returns (uint256 value) {
            return value;
        } catch {
            return defaultValue;
        }
    }

    function _envOrBool(string memory key, bool defaultValue) internal returns (bool) {
        try vm.envBool(key) returns (bool value) {
            return value;
        } catch {
            return defaultValue;
        }
    }
}
