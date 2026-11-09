// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Terrowa
/// @notice Experimental crop-coverage pool for BOT Chain. This is not a licensed insurance product.
contract Terrowa {
    uint256 public constant BPS = 10_000;
    uint256 public constant PAYOUT_BPS = 8_000;
    uint256 public constant STAKER_SHARE_BPS = 7_000;
    uint256 public constant MIN_DURATION = 30 days;
    uint256 public constant MAX_DURATION = 365 days;
    uint256 public constant WITHDRAWAL_LOCK = 7 days;
    uint256 private constant ACC_SCALE = 1e18;

    enum CoverageType { Drought, Flood, Frost, Pest, Comprehensive }
    enum PolicyStatus { Missing, Active, ClaimFiled, Paid, Expired }
    enum ClaimStatus { Missing, Pending, Paid, Rejected }

    struct Policy {
        address farmer;
        CoverageType coverageType;
        string crop;
        string region;
        uint128 cropValue;
        uint128 premium;
        uint128 payoutCap;
        uint64 startAt;
        uint64 endAt;
        PolicyStatus status;
    }

    struct Claim {
        uint256 policyId;
        address farmer;
        uint128 requestedAmount;
        uint64 filedAt;
        ClaimStatus status;
        string lossRecord;
        string evidenceCid;
        string assessorNote;
    }

    struct StakeAccount {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pending;
        uint64 unlockAt;
    }

    struct WeatherReport {
        CoverageType coverageType;
        string region;
        uint8 severity;
        uint64 reportedAt;
        address reporter;
    }

    address public owner;
    address public assessor;
    uint256 public policyCount;
    uint256 public claimCount;
    uint256 public weatherReportCount;
    uint256 public totalStaked;
    uint256 public totalActiveLiability;
    uint256 public totalClaimsPaid;
    uint256 public rewardReserve;
    uint256 public accRewardPerShare;
    uint256 private locked = 1;

    mapping(uint256 => Policy) public policies;
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => uint256) public latestClaimForPolicy;
    mapping(address => StakeAccount) public stakes;
    mapping(uint256 => WeatherReport) public weatherReports;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AssessorUpdated(address indexed assessor);
    event ReserveFunded(address indexed funder, uint256 amount);
    event PolicyBought(uint256 indexed policyId, address indexed farmer, uint256 premium, uint256 payoutCap);
    event PolicyExpired(uint256 indexed policyId);
    event ClaimFiled(uint256 indexed claimId, uint256 indexed policyId, address indexed farmer, uint256 requestedAmount);
    event ClaimReviewed(uint256 indexed claimId, ClaimStatus status, uint256 paidAmount, string note);
    event PoolStaked(address indexed account, uint256 amount, uint256 unlockAt);
    event PoolWithdrawn(address indexed account, uint256 amount);
    event RewardsClaimed(address indexed account, uint256 amount);
    event WeatherReported(uint256 indexed reportId, CoverageType indexed coverageType, string region, uint8 severity);

    error NotOwner();
    error NotAssessor();
    error InvalidInput();
    error InvalidState();
    error InsufficientLiquidity();
    error TransferFailed();
    error Locked();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAssessor() {
        if (msg.sender != assessor && msg.sender != owner) revert NotAssessor();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor() {
        owner = msg.sender;
        assessor = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AssessorUpdated(msg.sender);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidInput();
        address previous = owner;
        owner = nextOwner;
        emit OwnershipTransferred(previous, nextOwner);
    }

    function setAssessor(address nextAssessor) external onlyOwner {
        if (nextAssessor == address(0)) revert InvalidInput();
        assessor = nextAssessor;
        emit AssessorUpdated(nextAssessor);
    }

    function fundReserve() external payable {
        if (msg.value == 0) revert InvalidInput();
        emit ReserveFunded(msg.sender, msg.value);
    }

    function annualRateBps(CoverageType coverageType) public pure returns (uint256) {
        if (coverageType == CoverageType.Drought) return 300;
        if (coverageType == CoverageType.Flood) return 250;
        if (coverageType == CoverageType.Frost) return 200;
        if (coverageType == CoverageType.Pest) return 150;
        return 600;
    }

    function quotePremium(
        CoverageType coverageType,
        uint256 cropValue,
        uint256 durationSeconds
    ) public pure returns (uint256 premium, uint256 payoutCap) {
        if (cropValue == 0 || durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
            revert InvalidInput();
        }
        premium = cropValue * annualRateBps(coverageType) * durationSeconds / (365 days * BPS);
        if (premium == 0) premium = 1;
        payoutCap = cropValue * PAYOUT_BPS / BPS;
    }

    function availableReserve() public view returns (uint256) {
        uint256 protectedBalance = rewardReserve;
        return address(this).balance > protectedBalance ? address(this).balance - protectedBalance : 0;
    }

    function buyPolicy(
        CoverageType coverageType,
        string calldata crop,
        string calldata region,
        uint128 cropValue,
        uint64 durationSeconds
    ) external payable nonReentrant returns (uint256 policyId) {
        if (bytes(crop).length < 2 || bytes(region).length < 2) revert InvalidInput();
        (uint256 premium, uint256 payoutCap) = quotePremium(coverageType, cropValue, durationSeconds);
        if (msg.value != premium || premium > type(uint128).max || payoutCap > type(uint128).max) revert InvalidInput();

        uint256 stakerShare;
        if (totalStaked > 0) {
            stakerShare = premium * STAKER_SHARE_BPS / BPS;
            rewardReserve += stakerShare;
            accRewardPerShare += stakerShare * ACC_SCALE / totalStaked;
        }
        if (availableReserve() < totalActiveLiability + payoutCap) revert InsufficientLiquidity();

        policyId = ++policyCount;
        policies[policyId] = Policy({
            farmer: msg.sender,
            coverageType: coverageType,
            crop: crop,
            region: region,
            cropValue: cropValue,
            premium: uint128(premium),
            payoutCap: uint128(payoutCap),
            startAt: uint64(block.timestamp),
            endAt: uint64(block.timestamp + durationSeconds),
            status: PolicyStatus.Active
        });
        totalActiveLiability += payoutCap;
        emit PolicyBought(policyId, msg.sender, premium, payoutCap);
    }

    function expirePolicy(uint256 policyId) external {
        Policy storage policy = policies[policyId];
        if (policy.status != PolicyStatus.Active || block.timestamp <= policy.endAt) revert InvalidState();
        policy.status = PolicyStatus.Expired;
        totalActiveLiability -= policy.payoutCap;
        emit PolicyExpired(policyId);
    }

    function fileClaim(
        uint256 policyId,
        uint128 requestedAmount,
        string calldata lossRecord,
        string calldata evidenceCid
    ) external returns (uint256 claimId) {
        Policy storage policy = policies[policyId];
        if (policy.farmer != msg.sender || policy.status != PolicyStatus.Active || block.timestamp > policy.endAt) revert InvalidState();
        if (requestedAmount == 0 || requestedAmount > policy.payoutCap || bytes(lossRecord).length < 8 || bytes(evidenceCid).length < 10) revert InvalidInput();

        policy.status = PolicyStatus.ClaimFiled;
        claimId = ++claimCount;
        latestClaimForPolicy[policyId] = claimId;
        claims[claimId] = Claim({
            policyId: policyId,
            farmer: msg.sender,
            requestedAmount: requestedAmount,
            filedAt: uint64(block.timestamp),
            status: ClaimStatus.Pending,
            lossRecord: lossRecord,
            evidenceCid: evidenceCid,
            assessorNote: ""
        });
        emit ClaimFiled(claimId, policyId, msg.sender, requestedAmount);
    }

    function reviewClaim(uint256 claimId, bool approve, string calldata note) external onlyAssessor nonReentrant {
        Claim storage claim = claims[claimId];
        Policy storage policy = policies[claim.policyId];
        if (claim.status != ClaimStatus.Pending || policy.status != PolicyStatus.ClaimFiled) revert InvalidState();

        claim.assessorNote = note;
        if (!approve) {
            claim.status = ClaimStatus.Rejected;
            policy.status = block.timestamp <= policy.endAt ? PolicyStatus.Active : PolicyStatus.Expired;
            if (policy.status == PolicyStatus.Expired) totalActiveLiability -= policy.payoutCap;
            emit ClaimReviewed(claimId, ClaimStatus.Rejected, 0, note);
            return;
        }

        uint256 remainingLiability = totalActiveLiability - policy.payoutCap;
        if (address(this).balance < claim.requestedAmount + rewardReserve + remainingLiability) revert InsufficientLiquidity();
        claim.status = ClaimStatus.Paid;
        policy.status = PolicyStatus.Paid;
        totalActiveLiability = remainingLiability;
        totalClaimsPaid += claim.requestedAmount;
        (bool ok,) = payable(claim.farmer).call{value: claim.requestedAmount}("");
        if (!ok) revert TransferFailed();
        emit ClaimReviewed(claimId, ClaimStatus.Paid, claim.requestedAmount, note);
    }

    function pendingRewards(address account) public view returns (uint256) {
        StakeAccount storage position = stakes[account];
        uint256 accrued = position.amount * accRewardPerShare / ACC_SCALE;
        return position.pending + (accrued > position.rewardDebt ? accrued - position.rewardDebt : 0);
    }

    function stake() external payable nonReentrant {
        if (msg.value == 0) revert InvalidInput();
        StakeAccount storage position = stakes[msg.sender];
        _accrue(position);
        position.amount += msg.value;
        totalStaked += msg.value;
        position.unlockAt = uint64(block.timestamp + WITHDRAWAL_LOCK);
        position.rewardDebt = position.amount * accRewardPerShare / ACC_SCALE;
        emit PoolStaked(msg.sender, msg.value, position.unlockAt);
    }

    function withdrawStake(uint256 amount) external nonReentrant {
        StakeAccount storage position = stakes[msg.sender];
        if (block.timestamp < position.unlockAt) revert Locked();
        if (amount == 0 || amount > position.amount) revert InvalidInput();
        _accrue(position);
        if (address(this).balance < amount + rewardReserve + totalActiveLiability) revert InsufficientLiquidity();
        position.amount -= amount;
        totalStaked -= amount;
        position.rewardDebt = position.amount * accRewardPerShare / ACC_SCALE;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit PoolWithdrawn(msg.sender, amount);
    }

    function claimRewards() external nonReentrant {
        StakeAccount storage position = stakes[msg.sender];
        _accrue(position);
        uint256 amount = position.pending;
        if (amount == 0 || amount > rewardReserve) revert InvalidState();
        position.pending = 0;
        rewardReserve -= amount;
        position.rewardDebt = position.amount * accRewardPerShare / ACC_SCALE;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit RewardsClaimed(msg.sender, amount);
    }

    function reportWeather(CoverageType coverageType, string calldata region, uint8 severity) external onlyOwner returns (uint256 reportId) {
        if (bytes(region).length < 2 || severity == 0 || severity > 100) revert InvalidInput();
        reportId = ++weatherReportCount;
        weatherReports[reportId] = WeatherReport({
            coverageType: coverageType,
            region: region,
            severity: severity,
            reportedAt: uint64(block.timestamp),
            reporter: msg.sender
        });
        emit WeatherReported(reportId, coverageType, region, severity);
    }

    function _accrue(StakeAccount storage position) internal {
        uint256 accrued = position.amount * accRewardPerShare / ACC_SCALE;
        if (accrued > position.rewardDebt) position.pending += accrued - position.rewardDebt;
        position.rewardDebt = accrued;
    }
}
