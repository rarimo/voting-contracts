// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";
import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IVoting} from "./interfaces/IVoting.sol";
import {IBaseVerifier} from "./interfaces/verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "./interfaces/verifiers/IRegisterVerifier.sol";

import {PoseidonSMT} from "./utils/PoseidonSMT.sol";

/**
 * @title Voting Contract
 * @dev Implements a voting system with registration and voting phases, utilizing zk-SNARKs for privacy and integrity, and a Merkle tree for vote tracking.
 */
contract Voting is IVoting, PoseidonSMT, Initializable, OwnableUpgradeable {
    using TypeCaster for *; // TypeCaster library for type conversions.
    using VerifierHelper for address; // VerifierHelper library for zk-SNARK proof verification.

    uint256 public constant MAX_CANDIDATES = 100;

    /// The contract for registration proof verification
    IRegisterVerifier public immutable registerVerifier;

    /// The contract for voting proof verification
    address public immutable voteVerifier;

    /// The maximum depth of the Sparse Merkle Tree (SMT)
    uint256 public immutable smtTreeMaxDepth;

    /// Struct containing all relevant voting information
    VotingInfo public votingInfo;

    /// Mapping to track commitments and prevent duplicate registrations
    mapping(bytes32 => bool) public commitments;

    /// Mapping to track nullifiers and prevent double voting
    mapping(bytes32 => bool) public nullifiers;

    /// Mapping to track roots and validate their existence
    mapping(bytes32 => bool) public rootsHistory;

    /// Mapping of candidates available for voting
    mapping(bytes32 => bool) public candidates;

    /// Mapping to track votes per candidate
    mapping(bytes32 => uint256) public votesPerCandidate;

    /**
     * @notice Initializes a new Voting contract with specified verifiers and SMT tree depth.
     * @param voteVerifier_ Address of the voting proof verifier contract.
     * @param registerVerifier_ Address of the registration proof verifier contract.
     * @param treeHeight_ Maximum depth of the SMT used for vote tracking.
     */
    constructor(address voteVerifier_, address registerVerifier_, uint256 treeHeight_) {
        voteVerifier = voteVerifier_;
        registerVerifier = IRegisterVerifier(registerVerifier_);

        smtTreeMaxDepth = treeHeight_;
    }

    /**
     * @inheritdoc IVoting
     */
    function __Voting_init(VotingParams calldata votingParams_) external initializer {
        __Ownable_init();
        __PoseidonSMT_init(smtTreeMaxDepth);

        _validateVotingParams(votingParams_);

        votingInfo.remark = votingParams_.remark;
        votingInfo.values.commitmentStartTime = votingParams_.commitmentStart;
        votingInfo.values.votingStartTime =
            votingParams_.commitmentStart +
            votingParams_.commitmentPeriod;
        votingInfo.values.votingEndTime =
            votingInfo.values.votingStartTime +
            votingParams_.votingPeriod;
        votingInfo.values.candidates = votingParams_.candidates;

        for (uint256 i = 0; i < votingParams_.candidates.length; i++) {
            candidates[votingParams_.candidates[i]] = true;
        }

        emit VotingInitialized(msg.sender, votingParams_);
    }

    /**
     * @inheritdoc IVoting
     */
    function registerForVoting(
        IBaseVerifier.ProveIdentityParams memory proveIdentityParams_,
        IRegisterVerifier.RegisterProofParams memory registerProofParams_,
        IBaseVerifier.TransitStateParams memory transitStateParams_,
        bool isTransitState_
    ) external {
        require(
            getProposalStatus() == VotingStatus.COMMITMENT,
            "Voting: the voting must be in the commitment state to register"
        );

        bytes32 commitment_ = registerProofParams_.commitment;

        require(!commitments[commitment_], "Voting: commitment already exists");

        IRegisterVerifier.RegisterProofInfo memory registerProofInfo_ = IRegisterVerifier
            .RegisterProofInfo({
                registerProofParams: registerProofParams_,
                votingAddress: address(this)
            });

        if (isTransitState_) {
            registerVerifier.transitStateAndProveRegistration(
                proveIdentityParams_,
                registerProofInfo_,
                transitStateParams_
            );
        } else {
            registerVerifier.proveRegistration(proveIdentityParams_, registerProofInfo_);
        }

        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;

        emit UserRegistered(msg.sender, proveIdentityParams_, registerProofParams_);
    }

    /**
     * @inheritdoc IVoting
     */
    function vote(
        bytes32 root_,
        bytes32 nullifierHash_,
        bytes32 candidate_,
        VerifierHelper.ProofPoints memory proof_
    ) external {
        require(
            getProposalStatus() == VotingStatus.PENDING,
            "Voting: the voting must be in the pending state to vote"
        );

        require(!nullifiers[nullifierHash_], "Voting: nullifier already used");
        require(rootsHistory[root_], "Voting: root doesn't exist");
        require(candidates[candidate_], "Voting: candidate doesn't exist");

        require(
            voteVerifier.verifyProofSafe(
                [
                    uint256(nullifierHash_),
                    uint256(root_),
                    uint256(candidate_),
                    uint256(uint160(address(this)))
                ].asDynamic(),
                proof_,
                4
            ),
            "Voting: Invalid vote proof"
        );

        nullifiers[nullifierHash_] = true;

        votesPerCandidate[candidate_]++;
        votingInfo.counters.votesCount++;

        emit UserVoted(msg.sender, root_, nullifierHash_, candidate_);
    }

    /**
     * @inheritdoc IVoting
     */
    function getProposalStatus() public view returns (VotingStatus) {
        if (votingInfo.values.commitmentStartTime == 0) {
            return VotingStatus.NONE;
        }

        if (block.timestamp < votingInfo.values.commitmentStartTime) {
            return VotingStatus.NOT_STARTED;
        }

        if (block.timestamp < votingInfo.values.votingStartTime) {
            return VotingStatus.COMMITMENT;
        }

        if (block.timestamp < votingInfo.values.votingEndTime) {
            return VotingStatus.PENDING;
        }

        return VotingStatus.ENDED;
    }

    /**
     * @dev The temporary function (only needed to speed up development process and testing) to add the root to the history
     * Will be removed.
     */
    function addRoot(bytes32 root_) external onlyOwner {
        rootsHistory[root_] = true;
    }

    function _validateVotingParams(VotingParams calldata votingParams_) internal view {
        require(
            votingParams_.commitmentStart > block.timestamp,
            "Voting: commitment start must be in the future"
        );
        require(
            votingParams_.commitmentPeriod > 0,
            "Voting: commitment period must be greater than 0"
        );
        require(votingParams_.votingPeriod > 0, "Voting: voting period must be greater than 0");
        require(votingParams_.candidates.length > 0, "Voting: candidates must be provided");
        require(votingParams_.candidates.length <= MAX_CANDIDATES, "Voting: too many candidates");
    }
}
