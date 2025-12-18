# Post2Earn.sol: Decentralized Social Media Promotions

This document provides a detailed explanation of the `Post2Earn.sol` smart contract, a decentralized application for creating and managing social media promotion campaigns.

## 1. Overview

The `Post2Earn.sol` contract establishes a trustless ecosystem where users can either be **Promoters** or **Engagers**. Promoters create campaigns to increase the visibility of their content, while Engagers participate in these campaigns to earn rewards. The contract is built on the Ethereum blockchain and leverages ERC20 tokens for rewards, ensuring transparency, security, and decentralization.

## 2. Core Components

### Roles

- **Owner**: The contract deployer, with administrative privileges to manage contract-level settings.
- **Promoter**: A user who creates a promotion by locking a specified amount of ERC20 tokens as rewards.
- **Engager**: A user who participates in a promotion by performing a required social media action (e.g., commenting, reposting).

### Key Structs

- **`Promotion`**: Stores all the essential details of a promotion, including the promoter's address, the reward token, the number of slots, the reward per slot, and the expiration date.
- **`Engagement`**: Records the participation of an engager in a promotion, including their address, social media details, and whether they have claimed their reward.

## 3. Core Functionality

### Creating a Promotion

A promotion is initiated when a Promoter calls the `createPromotion` function. This function requires several parameters to define the campaign's rules:

- **Reward Token**: The ERC20 token that will be used for rewards.
- **Promotion Type**: The nature of the engagement (e.g., `Comment`, `Repost`).
- **Slots Available**: The maximum number of participants who can claim a reward.
- **Vault Amount**: The total amount of tokens to be locked in the contract for the promotion.
- **Reward Per Slot**: The amount of tokens each engager will receive.

When a promotion is created, the contract calculates the required vault amount, including a platform fee, and transfers the tokens from the Promoter's wallet to the contract. This ensures that the funds are secured for the Engagers.

### Engaging in a Promotion

Engagers can participate in a promotion through the `engage` or `engageWithIframe` functions. The engagement process is designed to be secure and user-friendly:

- **Signature-Based Engagement**: Engagers sign an EIP-712 compliant message with their engagement details. This signature is then submitted to the contract by a trusted `extensionWallet`, which pays the gas fees on behalf of the user.
- **Duplicate Engagement Prevention**: The contract ensures that an engager can participate in a promotion only once and that each social media account is used only once per promotion.

### Claiming Rewards

Once a promotion has expired, Engagers can claim their rewards by calling the `claimReward` or `claimAllRewards` functions. The contract verifies that the promotion has expired and that the user has a valid, unclaimed engagement before transferring the reward.

## 4. Economic Model

### Fees

The contract incorporates a fee structure to ensure its sustainability:

- **Platform Promotion Fee**: A percentage of the promotion's vault, charged to the Promoter upon creation.
- **Cancel Promotion Penalty Fee**: A fee charged to the Promoter if they cancel a promotion before it expires.
- **Subscription Fee**: A fee for using non-platform tokens as rewards, which grants a 30-day subscription.

### Scoring System

The contract includes a scoring system to track the contributions of Promoters and Engagers:

- **Promoter Scores**: Promoters earn points based on the net vault amount of their promotions.
- **Engager Scores**: Engagers earn points based on the rewards they claim.

## 5. Administrative Functions

The contract owner has access to several administrative functions to manage the platform:

- **`setExtensionWallet`**: Updates the address of the trusted extension wallet.
- **`setPlatformFeeWallet`**: Sets the wallet that receives platform fees.
- **`setSubscriptionFee`**: Adjusts the subscription fee for using non-platform tokens.
- **`setPlatformPromoteFee`**: Modifies the platform fee for creating promotions.
- **`setCancelPromotionPenaltyFee`**: Changes the penalty fee for canceling promotions.

## 6. Data Retrieval (Getters)

The contract provides a rich set of getter functions for retrieving data about promotions and engagements. These functions are optimized for efficiency and support filtering and pagination, allowing for a responsive user experience.

- **`getActivePromotionsByLatest` / `getActivePromotionsByOldest`**: Retrieve active promotions, sorted by creation time.
- **`getActivePromotionsByVaultAmount` / `getActivePromotionsByEngagersRange`**: Filter promotions based on their vault size or the number of participants.
- **`getActivePromotionsByType`**: Fetches promotions of a specific type (e.g., only `Comment` promotions).
- **`getUnclaimedRewards`**: Allows an engager to see all the rewards they are eligible to claim.