// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract Post2Earn is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    IERC20 public platformToken;
    address public extensionWallet;
    address private platformFeeWallet;
    address public constant DEFAULT_SUBSCRIBED_TOKEN = 0xB8d7710f7d8349A506b75dD184F05777c82dAd0C;
    uint256 private constant DEFAULT_SUBSCRIPTION_DURATION = 5 * 365 days;

    uint256 public cancelPromotionPenaltyFee;
    uint256 public platformPromoteFee;
    uint256 public promotionCount;
    uint256 public subscriptionFee;

    // token address => subscription expiry timestamp
    mapping(address => uint256) public subscriptions;
    // token address => address that last paid for the subscription
    mapping(address => address) private _tokenSubscribers;

    // List of all tokens that have ever been subscribed (for enumeration in getters)
    address[] private _subscribedTokenList;
    mapping(address => bool) private _tokenTracked;

    enum PromotionType { Comment, Repost, Quote }
    enum PromoterPromotionFilter { All, CancelAvailable, ExpiredWithUnusedVault, VaultClaimed }

    struct Promotion {
        address promoter;
        PromotionType promotionType;
        uint256 slotsAvailable;
        uint256 slotsTaken;
        uint256 vaultAmount;
        uint256 rewardPerSlot;
        uint256 minFollowers;
        uint256 expiresOn;
        string postId;
        string contentURI;
        bytes32 contentHash;
        IERC20 rewardToken;
        string arenaUserId;
        bool active;
    }

    struct Engagement {
        address engager;
        string twitterUsername;
        string engagementPostId;
        uint256 followerCount;
        string arenaUserId;
        bool rewarded;
    }

    // promotionId => Promotion
    mapping(uint256 => Promotion) public promotions;
    // promotionId => engager => Engagement
    mapping(uint256 => mapping(address => Engagement)) public engagementsData;
    // promotionId => engagers list
    mapping(uint256 => address[]) public engagerList;
    // engager => promotionIds
    mapping(address => uint256[]) public engagerToPromotionIds;
    // postId => promotionIds
    mapping(string => uint256[]) public postIdToPromotionIds;
    // promoter => promotionIds
    mapping(address => uint256[]) public promoterToPromotionIds;
    // promotionId => twitterUsername => bool
    mapping(uint256 => mapping(string => bool)) public twitterUsernameTaken;

    // Leaderboard scores
    mapping(address => uint256) public promoterScores;
    mapping(address => uint256) public engagerScores;

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

    event Engaged(
        uint256 indexed promotionId,
        address indexed engager,
        string twitterUsername,
        uint256 reward
    );

    event RewardClaimed(
        uint256 indexed promotionId,
        address indexed engager,
        uint256 reward,
        uint256 newEngagerScore,
        string arenaUserId
    );

    event Subscribed(
        address indexed subscriber,
        address indexed token,
        uint256 amount,
        uint256 expiresOn,
        string arenaUserId
    );

    constructor(IERC20 _platformToken, address _extensionWallet) Ownable(msg.sender) EIP712("Post2Earn", "1") {
        platformToken = _platformToken; 
        extensionWallet = _extensionWallet;
        platformFeeWallet = msg.sender; // Default to owner, can be changed later
        cancelPromotionPenaltyFee = 25; // Default to 25%
        platformPromoteFee = 5; // Default to 5%
        subscriptionFee = 1 * 1e18; // 1 AVAX

        _initializeDefaultSubscription(msg.sender);
    }

    // ----------- CREATE PROMOTION -----------
    function createPromotion(
        IERC20 _rewardToken,
        PromotionType _promotionType,
        uint256 _slotsAvailable,
        uint256 _vaultAmount,
        uint256 _minFollowers,
        uint256 _expiresOn,
        string calldata _postId,
        string calldata _contentURI,
        string calldata _content,
        string calldata _arenaUserId
    ) external whenNotPaused nonReentrant {
        if (_rewardToken != platformToken) {
            require(subscriptions[address(_rewardToken)] >= block.timestamp, "Token subscription expired");
        }
        require(_slotsAvailable > 0 && _slotsAvailable <= 1000, "Invalid slots");
        require(_vaultAmount >= 100 * 1e18, "Vault too low");
        require(_expiresOn > block.timestamp, "Expiry in past");
        require(_expiresOn <= block.timestamp + 7 days + 2 minutes, "Expiry too far should be less than 7 days");
        
        // Use provided gross vault amount: compute fee and net vault actually received
        uint256 actualFee = (_vaultAmount * platformPromoteFee) / 100;
        uint256 transferAmount = _vaultAmount - actualFee;
        require(transferAmount > 0, "Vault too low after fee");

        if (actualFee > 0) {
            _rewardToken.safeTransferFrom(msg.sender, platformFeeWallet, actualFee);
        }

        uint256 beforeBalance = _rewardToken.balanceOf(address(this));
        _rewardToken.safeTransferFrom(msg.sender, address(this), transferAmount);
        uint256 netVaultAmount = _rewardToken.balanceOf(address(this)) - beforeBalance;
        require(netVaultAmount >= _slotsAvailable, "Reward per slot too low"); // ensure at least 1 wei per slot

        bytes32 contentHash = keccak256(bytes(_content));



        uint256 newPromotionId = promotionCount;

        // Compute reward per slot from net vault
        uint256 computedRewardPerSlot = netVaultAmount / _slotsAvailable; // floor division; any remainder stays in vault as dust

        promotions[newPromotionId] = Promotion({
            promoter: msg.sender,
            promotionType: _promotionType,
            slotsAvailable: _slotsAvailable,
            slotsTaken: 0,
            vaultAmount: netVaultAmount,
            rewardPerSlot: computedRewardPerSlot,
            minFollowers: _minFollowers,
            expiresOn: _expiresOn,
            postId: _postId,
            contentURI: _contentURI,
            contentHash: contentHash,
            rewardToken: _rewardToken,
            arenaUserId: _arenaUserId,
            active: true
        });

        postIdToPromotionIds[_postId].push(newPromotionId);
        promoterToPromotionIds[msg.sender].push(newPromotionId);

        // Update promoter score only for platform token promotions
        if (_rewardToken == platformToken) {
            promoterScores[msg.sender] += netVaultAmount;
        }

        emit PromotionCreated(
            newPromotionId,
            msg.sender,
            _postId,
            _slotsAvailable,
            netVaultAmount,
            computedRewardPerSlot,
            promoterScores[msg.sender],
            _arenaUserId
        );

        promotionCount++;
    }

    // ----------- ENGAGE PROMOTION -----------
    function engage(
        uint256 _promotionId,
        string calldata _twitterUsername,
        string calldata _engagementPostId,
        uint256 _followerCount,
        address _engager,
        string calldata _content,
        bytes calldata _signature,
        string calldata _arenaUserId
    ) external onlyExtension whenNotPaused {
        bytes32 digest = _hash(_promotionId, _twitterUsername, _engagementPostId, _followerCount, _engager, _arenaUserId);
        address signer = ECDSA.recover(digest, _signature);
        require(signer != address(0), "Invalid signature");
        require(signer == _engager, "Invalid signature");
        Promotion storage promo = promotions[_promotionId];

        require(promo.active, "Promotion inactive");
        require(block.timestamp < promo.expiresOn, "Promotion expired");
        require(promo.slotsTaken < promo.slotsAvailable, "No slots left");
        require(_followerCount >= promo.minFollowers, "Not enough followers");
        require(keccak256(bytes(_content)) == promo.contentHash, "Content hash mismatch");

        // Check for duplicate engagement
        require(engagementsData[_promotionId][_engager].engager == address(0), "Already engaged");
        require(!twitterUsernameTaken[_promotionId][_twitterUsername], "Twitter username already used");

        // Record engagement
        engagementsData[_promotionId][_engager] = Engagement({
            engager: _engager,
            twitterUsername: _twitterUsername,
            engagementPostId: _engagementPostId,
            followerCount: _followerCount,
            arenaUserId: _arenaUserId,
            rewarded: false
        });
        engagerList[_promotionId].push(_engager);
        engagerToPromotionIds[_engager].push(_promotionId);
        twitterUsernameTaken[_promotionId][_twitterUsername] = true;

        promo.slotsTaken++;

        emit Engaged(_promotionId, _engager, _twitterUsername, promo.rewardPerSlot);

        // If slots filled, close promotion
        if (promo.slotsTaken >= promo.slotsAvailable) {
            promo.active = false;
        }
    }

    // ----------- ENGAGE PROMOTION (IFRAME) -----------
    function engageWithIframe(
        uint256 _promotionId,
        string calldata _twitterUsername,
        string calldata _engagementPostId,
        uint256 _followerCount,
        address _engager,
        string calldata _content,
        string calldata _arenaUserId
    ) external onlyExtension whenNotPaused {
        Promotion storage promo = promotions[_promotionId];

        require(promo.active, "Promotion inactive");
        require(block.timestamp < promo.expiresOn, "Promotion expired");
        require(promo.slotsTaken < promo.slotsAvailable, "No slots left");
        require(_followerCount >= promo.minFollowers, "Not enough followers");
        require(keccak256(bytes(_content)) == promo.contentHash, "Content hash mismatch");

        // Check for duplicate engagement
        require(engagementsData[_promotionId][_engager].engager == address(0), "Already engaged");
        require(!twitterUsernameTaken[_promotionId][_twitterUsername], "Twitter username already used");

        // Record engagement
        engagementsData[_promotionId][_engager] = Engagement({
            engager: _engager,
            twitterUsername: _twitterUsername,
            engagementPostId: _engagementPostId,
            followerCount: _followerCount,
            arenaUserId: _arenaUserId,
            rewarded: false
        });
        engagerList[_promotionId].push(_engager);
        engagerToPromotionIds[_engager].push(_promotionId);
        twitterUsernameTaken[_promotionId][_twitterUsername] = true;

        promo.slotsTaken++;

        emit Engaged(_promotionId, _engager, _twitterUsername, promo.rewardPerSlot);

        // If slots filled, close promotion
        if (promo.slotsTaken >= promo.slotsAvailable) {
            promo.active = false;
        }
    }

    // ----------- CLAIM REWARD ----------- 
    function claimReward(uint256 _promotionId) external whenNotPaused nonReentrant {
        Promotion storage promo = promotions[_promotionId];
        require(block.timestamp >= promo.expiresOn, "Promotion not expired");

        Engagement storage engagement = engagementsData[_promotionId][msg.sender];
        require(engagement.engager != address(0), "Not an engager");
        require(!engagement.rewarded, "Reward already claimed");

        engagement.rewarded = true;
        promo.rewardToken.safeTransfer(msg.sender, promo.rewardPerSlot);

        // Update engager score only for platform token promotions
        if (promo.rewardToken == platformToken) {
            engagerScores[msg.sender] += promo.rewardPerSlot;
        }

        emit RewardClaimed(_promotionId, msg.sender, promo.rewardPerSlot, engagerScores[msg.sender], engagement.arenaUserId);
    }

    // ----------- CLAIM ALL REWARDS ----------- 
    function claimAllRewards(IERC20 _rewardToken) external whenNotPaused nonReentrant {
        uint256[] storage userPromotions = engagerToPromotionIds[msg.sender];
        uint256 totalReward = 0;

        for (uint256 i = 0; i < userPromotions.length; i++) {
            uint256 promotionId = userPromotions[i];
            Promotion storage promo = promotions[promotionId];

            if (promo.rewardToken != _rewardToken || block.timestamp < promo.expiresOn) {
                continue;
            }

            Engagement storage engagement = engagementsData[promotionId][msg.sender];

            if (engagement.engager == address(0) || engagement.rewarded) {
                continue;
            }

            engagement.rewarded = true;
            totalReward += promo.rewardPerSlot;
            
            if (_rewardToken == platformToken) {
                engagerScores[msg.sender] += promo.rewardPerSlot;
            }

            emit RewardClaimed(promotionId, msg.sender, promo.rewardPerSlot, engagerScores[msg.sender], engagement.arenaUserId);
        }

        require(totalReward > 0, "No rewards to claim for this token");
        _rewardToken.safeTransfer(msg.sender, totalReward);
    }

    // ----------- PROMOTER CANCEL (before expiry, with fee) -----------
    function cancelPromotion(uint256 _promotionId) external nonReentrant {
        Promotion storage promo = promotions[_promotionId];
        require(msg.sender == promo.promoter, "Not promoter");
        require(promo.active, "Already inactive");
        require(block.timestamp < promo.expiresOn, "Promotion has expired");

        uint256 remainingSlots = promo.slotsAvailable - promo.slotsTaken;
        uint256 totalRefundable = remainingSlots * promo.rewardPerSlot;

        promo.active = false;

        if (totalRefundable > 0) {
            uint256 platformFee = (totalRefundable * cancelPromotionPenaltyFee) / 100;
            uint256 promoterRefund = totalRefundable - platformFee;

            if (platformFee > 0) {
                promo.rewardToken.safeTransfer(platformFeeWallet, platformFee);
            }
            if (promoterRefund > 0) {
                if (promo.rewardToken == platformToken) {
                    promoterScores[msg.sender] -= promoterRefund;
                }
                promo.rewardToken.safeTransfer(msg.sender, promoterRefund);
            }
        }
    }

    // ----------- PROMOTER WITHDRAW (after expiry, no fee) -----------
    function withdrawFromExpiredPromotion(uint256 _promotionId) external nonReentrant {
        Promotion storage promo = promotions[_promotionId];
        require(msg.sender == promo.promoter, "Not promoter");
        require(promo.active, "Already inactive");
        require(block.timestamp >= promo.expiresOn, "Promotion not expired");

        uint256 remainingSlots = promo.slotsAvailable - promo.slotsTaken;
        uint256 refundAmount = remainingSlots * promo.rewardPerSlot;

        promo.active = false;

        if (refundAmount > 0) {
            if (promo.rewardToken == platformToken) {
                promoterScores[msg.sender] -= refundAmount;
            }
            promo.rewardToken.safeTransfer(msg.sender, refundAmount);
        }
    }

    // ----------- CLAIM ALL UNUSED VAULT (after expiry, no fee) -----------
    function claimAllUnusedVault(IERC20 _rewardToken) external nonReentrant {
        uint256[] memory promoterPromotions = promoterToPromotionIds[msg.sender];
        uint256 totalRefundAmount = 0;

        for (uint256 i = 0; i < promoterPromotions.length; i++) {
            uint256 promotionId = promoterPromotions[i];
            Promotion storage promo = promotions[promotionId];

            if (promo.rewardToken == _rewardToken && promo.active && block.timestamp >= promo.expiresOn) {
                uint256 remainingSlots = promo.slotsAvailable - promo.slotsTaken;
                if (remainingSlots > 0) {
                    uint256 refundAmount = remainingSlots * promo.rewardPerSlot;
                    totalRefundAmount += refundAmount;
                    promo.active = false;
                }
            }
        }

        require(totalRefundAmount > 0, "No funds to claim for this token");

        if (_rewardToken == platformToken) {
            promoterScores[msg.sender] -= totalRefundAmount;
        }
        _rewardToken.safeTransfer(msg.sender, totalRefundAmount);
    }

    // ----------- GETTERS ----------- 

    function getScore(address _user, bool _isPromoter) external view returns (uint256) {
        if (_isPromoter) {
            return promoterScores[_user];
        }
        return engagerScores[_user];
    }

    function getEngagementsCount(uint256 _promotionId) public view returns (uint256) {
        return engagerList[_promotionId].length;
    }

    function getUnclaimedRewards(address _engager) external view returns (uint256[] memory) {
        uint256[] memory userPromotions = engagerToPromotionIds[_engager];
        uint256[] memory unclaimed = new uint256[](userPromotions.length);
        uint256 count = 0;

        for (uint256 i = 0; i < userPromotions.length; i++) {
            uint256 promotionId = userPromotions[i];
            if (!engagementsData[promotionId][_engager].rewarded) {
                unclaimed[count] = promotionId;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = unclaimed[i];
        }

        return result;
    }

    function getPromotionDetails(uint256 _promotionId) external view returns (Promotion memory) {
        return promotions[_promotionId];
    }

    function getPromotionEngagementData(uint256 _promotionId) external view returns (Engagement[] memory) {
        address[] memory engagers = engagerList[_promotionId];
        Engagement[] memory engagementDetails = new Engagement[](engagers.length);

        for (uint i = 0; i < engagers.length; i++) {
            engagementDetails[i] = engagementsData[_promotionId][engagers[i]];
        }

        return engagementDetails;
    }

    function getPromoterCreatedPromotions(
        address _promoter,
        uint256 offset,
        uint256 limit,
        bool newestFirst,
        PromoterPromotionFilter filter
    ) external view returns (uint256[] memory) {
        require(limit > 0, "limit=0");

        uint256[] storage createdPromotions = promoterToPromotionIds[_promoter];
        if (createdPromotions.length == 0) {
            return new uint256[](0);
        }

        uint256[] memory temp = new uint256[](limit);
        uint256 found = 0;
        uint256 skipped = 0;

        if (newestFirst) {
            for (uint256 i = createdPromotions.length; i > 0; i--) {
                uint256 id = createdPromotions[i - 1];
                Promotion storage promo = promotions[id];

                if (!_matchesPromoterFilter(promo, filter)) {
                    continue;
                }

                if (skipped < offset) {
                    skipped++;
                    continue;
                }

                temp[found] = id;
                found++;

                if (found == limit) {
                    break;
                }
            }
        } else {
            for (uint256 i = 0; i < createdPromotions.length; i++) {
                uint256 id = createdPromotions[i];
                Promotion storage promo = promotions[id];

                if (!_matchesPromoterFilter(promo, filter)) {
                    continue;
                }

                if (skipped < offset) {
                    skipped++;
                    continue;
                }

                temp[found] = id;
                found++;

                if (found == limit) {
                    break;
                }
            }
        }

        uint256[] memory result = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            result[j] = temp[j];
        }

        return result;
    }

    function getTokenUnusedVault(address _tokenAddress, address _promoter) external view returns (uint256) {
        uint256 totalUnusedVault = 0;

        for (uint256 i = 0; i < promotionCount; i++) {
            Promotion storage promo = promotions[i];

            if (promo.rewardToken == IERC20(_tokenAddress) && promo.promoter == _promoter && promo.active && block.timestamp >= promo.expiresOn) {
                if (promo.slotsTaken < promo.slotsAvailable) {
                    uint256 remainingSlots = promo.slotsAvailable - promo.slotsTaken;
                    totalUnusedVault += remainingSlots * promo.rewardPerSlot;
                }
            }
        }

        return totalUnusedVault;
    }

    function isPromotionAvailable(string calldata _postId) external view returns (bool) {
        uint256[] memory promotionIds = postIdToPromotionIds[_postId];
        for (uint i = 0; i < promotionIds.length; i++) {
            if (promotions[promotionIds[i]].active) {
                return true;
            }
        }
        return false;
    }

    function getHash(uint256 _promotionId, string calldata _twitterUsername, string calldata _engagementPostId, uint256 _followerCount, address _engager, string calldata _arenaUserId) external view returns (bytes32) {
        return _hash(_promotionId, _twitterUsername, _engagementPostId, _followerCount, _engager, _arenaUserId);
    }

    function _hash(uint256 _promotionId, string calldata _twitterUsername, string calldata _engagementPostId, uint256 _followerCount, address _engager, string calldata _arenaUserId) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Engagement(uint256 promotionId,string twitterUsername,string engagementPostId,uint256 followerCount,address engager,string arenaUserId)"),
            _promotionId,
            keccak256(bytes(_twitterUsername)),
            keccak256(bytes(_engagementPostId)),
            _followerCount,
            _engager,
            keccak256(bytes(_arenaUserId))
        )));
    }

    // ----------- FILTERED, PAGINATED GETTERS -----------
    // Always returns only promotions that are active and not expired.

    // Latest first (newestFirst = true), paginated over active & non-expired promotions
    function getActivePromotionsByLatest(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _getActivePromotionsFiltered(offset, limit, true, 0, type(uint256).max, 0, type(uint256).max);
    }

    // Oldest first (newestFirst = false), paginated over active & non-expired promotions
    function getActivePromotionsByOldest(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _getActivePromotionsFiltered(offset, limit, false, 0, type(uint256).max, 0, type(uint256).max);
    }

    // Filter by total vault amount (aka price allocated) range, with ordering and pagination controls
    function getActivePromotionsByVaultAmount(
        uint256 minVaultAmount,
        uint256 maxVaultAmount,
        uint256 offset,
        uint256 limit,
        bool newestFirst
    ) external view returns (uint256[] memory) {
        require(maxVaultAmount >= minVaultAmount, "Invalid vault range");
        return _getActivePromotionsFiltered(offset, limit, newestFirst, minVaultAmount, maxVaultAmount, 0, type(uint256).max);
    }

    // Filter by number of engagers (slotsTaken) range, with ordering and pagination controls
    function getActivePromotionsByEngagersRange(
        uint256 minEngagers,
        uint256 maxEngagers,
        uint256 offset,
        uint256 limit,
        bool newestFirst
    ) external view returns (uint256[] memory) {
        require(maxEngagers >= minEngagers, "Invalid engagers range");
        return _getActivePromotionsFiltered(offset, limit, newestFirst, 0, type(uint256).max, minEngagers, maxEngagers);
    }

    // Filter by promotion type, with ordering and pagination controls
    function getActivePromotionsByType(
        PromotionType promotionType,
        uint256 offset,
        uint256 limit,
        bool newestFirst
    ) external view returns (uint256[] memory) {
        require(limit > 0, "limit=0");

        uint256[] memory temp = new uint256[](limit);
        uint256 found = 0;
        uint256 skipped = 0;

        if (newestFirst) {
            for (uint256 i = promotionCount; i > 0; i--) {
                uint256 id = i - 1;
                Promotion storage p = promotions[id];
                if (!_isPromotionLive(p) || p.promotionType != promotionType) continue;

                if (skipped < offset) {
                    skipped++;
                    continue;
                }

                temp[found] = id;
                found++;
                if (found == limit) break;
            }
        } else {
            for (uint256 id = 0; id < promotionCount; id++) {
                Promotion storage p = promotions[id];
                if (!_isPromotionLive(p) || p.promotionType != promotionType) continue;

                if (skipped < offset) {
                    skipped++;
                    continue;
                }

                temp[found] = id;
                found++;
                if (found == limit) break;
            }
        }

        // Trim to actual length
        uint256[] memory result = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            result[j] = temp[j];
        }
        return result;
    }

    // Shared internal helper to apply filters and pagination in the requested ordering.
    function _getActivePromotionsFiltered(
        uint256 offset,
        uint256 limit,
        bool newestFirst,
        uint256 minVault,
        uint256 maxVault,
        uint256 minEngagers,
        uint256 maxEngagers
    ) internal view returns (uint256[] memory) {
        require(limit > 0, "limit=0");

        uint256[] memory temp = new uint256[](limit);
        uint256 found = 0;
        uint256 skipped = 0;

        if (newestFirst) {
            for (uint256 i = promotionCount; i > 0; i--) {
                uint256 id = i - 1;
                Promotion storage p = promotions[id];
                if (!_isPromotionLive(p)) continue;

                uint256 engCount = p.slotsTaken; // equals number of engagements
                if (p.vaultAmount < minVault || p.vaultAmount > maxVault) continue;
                if (engCount < minEngagers || engCount > maxEngagers) continue;

                if (skipped < offset) {
                    skipped++;
                    continue;
                }

                temp[found] = id;
                found++;
                if (found == limit) break;
            }
        } else {
            for (uint256 id = 0; id < promotionCount; id++) {
                Promotion storage p = promotions[id];
                if (!_isPromotionLive(p)) continue;

                uint256 engCount = p.slotsTaken; // equals number of engagements
                if (p.vaultAmount < minVault || p.vaultAmount > maxVault) continue;
                if (engCount < minEngagers || engCount > maxEngagers) continue;

                if (skipped < offset) {
                    skipped++;
                    continue;
                }

                temp[found] = id;
                found++;
                if (found == limit) break;
            }
        }

        // Trim to actual length
        uint256[] memory result = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            result[j] = temp[j];
        }
        return result;
    }

    // Helper: promotion is active and not expired
    function _isPromotionLive(Promotion storage promo) internal view returns (bool) {
        return promo.active && block.timestamp < promo.expiresOn;
    }

    function setExtensionWallet(address _newExtensionWallet) external onlyOwner {
        extensionWallet = _newExtensionWallet;
    }

    function setPlatformFeeWallet(address _newPlatformFeeWallet) external onlyOwner {
        platformFeeWallet = _newPlatformFeeWallet;
    }

    function setSubscriptionFee(uint256 _newFee) external onlyOwner {
        subscriptionFee = _newFee;
    }

    function subscribe(IERC20 _tokenToSubscribe, string calldata _arenaUserId, uint256 _months) external payable nonReentrant {
        require(address(_tokenToSubscribe) != address(0), "Invalid token address");
        require(address(_tokenToSubscribe) != address(platformToken), "Cannot subscribe platform token");
        require(subscriptionFee > 0, "Subscriptions not enabled");
        require(_months > 0, "Months must be greater than 0");
        require(msg.value == subscriptionFee * _months, "Incorrect subscription fee");

        (bool success, ) = platformFeeWallet.call{value: msg.value}("");
        require(success, "Failed to send fee");

        uint256 subscriptionDuration = _months * 30 days;
        uint256 newExpiry;
        uint256 currentExpiry = subscriptions[address(_tokenToSubscribe)];
        if (currentExpiry > block.timestamp) {
            // Active subscription, so renew
            newExpiry = currentExpiry + subscriptionDuration;
        } else {
            // Expired or new subscription
            newExpiry = block.timestamp + subscriptionDuration;
        }
        address tokenAddress = address(_tokenToSubscribe);
        subscriptions[tokenAddress] = newExpiry;
        _tokenSubscribers[tokenAddress] = msg.sender;

        // Track token in enumeration list if first time seen
        if (!_tokenTracked[tokenAddress]) {
            _tokenTracked[tokenAddress] = true;
            _subscribedTokenList.push(tokenAddress);
        }

        emit Subscribed(msg.sender, tokenAddress, msg.value, newExpiry, _arenaUserId);
    }

    function setPlatformPromoteFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 100, "Fee too high");
        platformPromoteFee = _newFeePercent;
    }

    function setCancelPromotionPenaltyFee(uint256 _newFeePercent) external onlyOwner {
        require(_newFeePercent <= 100, "Fee too high");
        cancelPromotionPenaltyFee = _newFeePercent;
    }

    function setPlatformToken(IERC20 _newPlatformToken) external onlyOwner {
        require(address(_newPlatformToken) != address(0), "Invalid token address");
        platformToken = _newPlatformToken;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    modifier onlyExtension() {
        require(msg.sender == extensionWallet, "Not authorized");
        _; 
    }

    // ----------- SUBSCRIPTION GETTERS -----------
    // Returns the list of token addresses with active subscriptions and their time remaining to expire (in seconds)
    function getActiveSubscriptions() external view returns (address[] memory tokens, uint256[] memory timeToExpire, address[] memory subscribers) {
        uint256 activeCount = 0;
        // First pass: count active
        for (uint256 i = 0; i < _subscribedTokenList.length; i++) {
            address token = _subscribedTokenList[i];
            uint256 exp = subscriptions[token];
            if (exp > block.timestamp) {
                activeCount++;
            }
        }

        tokens = new address[](activeCount);
        timeToExpire = new uint256[](activeCount);
        subscribers = new address[](activeCount);

        // Second pass: populate
        uint256 idx = 0;
        for (uint256 i = 0; i < _subscribedTokenList.length; i++) {
            address token = _subscribedTokenList[i];
            uint256 exp = subscriptions[token];
            if (exp > block.timestamp) {
                tokens[idx] = token;
                timeToExpire[idx] = exp - block.timestamp;
                subscribers[idx] = _tokenSubscribers[token];
                idx++;
            }
        }
    }

    function _initializeDefaultSubscription(address subscriber) internal {
        if (DEFAULT_SUBSCRIBED_TOKEN == address(0)) {
            return;
        }

        uint256 expiry = block.timestamp + DEFAULT_SUBSCRIPTION_DURATION;
        subscriptions[DEFAULT_SUBSCRIBED_TOKEN] = expiry;
        _tokenSubscribers[DEFAULT_SUBSCRIBED_TOKEN] = subscriber;

        if (!_tokenTracked[DEFAULT_SUBSCRIBED_TOKEN]) {
            _tokenTracked[DEFAULT_SUBSCRIBED_TOKEN] = true;
            _subscribedTokenList.push(DEFAULT_SUBSCRIBED_TOKEN);
        }

        emit Subscribed(subscriber, DEFAULT_SUBSCRIBED_TOKEN, 0, expiry, "");
    }

    function _matchesPromoterFilter(Promotion storage promo, PromoterPromotionFilter filter) internal view returns (bool) {
        if (filter == PromoterPromotionFilter.All) {
            return true;
        }
        if (filter == PromoterPromotionFilter.CancelAvailable) {
            return promo.active && block.timestamp < promo.expiresOn;
        }
        if (filter == PromoterPromotionFilter.ExpiredWithUnusedVault) {
            return promo.active && block.timestamp >= promo.expiresOn && promo.slotsTaken < promo.slotsAvailable;
        }
        if (filter == PromoterPromotionFilter.VaultClaimed) {
            return !promo.active && promo.slotsTaken < promo.slotsAvailable;
        }
        return false;
    }
}
