// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";
import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IVoting} from "./interfaces/IVoting.sol";
import {IVerifier} from "./interfaces/IVerifier.sol";
import {IBaseVerifier} from "./interfaces/verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "./interfaces/verifiers/IRegisterVerifier.sol";

import {PoseidonSMT} from "./utils/PoseidonSMT.sol";

/**
 * @title Voting
 */
contract Voting is IVoting, PoseidonSMT, Initializable, OwnableUpgradeable {
    using TypeCaster for *; // TypeCaster library for type conversions.
    using VerifierHelper for address; // VerifierHelper library for zk-SNARK proof verification.

    /**
     * @notice The verifier contract for the registration proof (zk-SNARK)
     */
    IRegisterVerifier public immutable registerVerifier;

    /**
     * @notice The verifier contract for the voting proof (zk-SNARK)
     */
    address public immutable voteVerifier;

    /**
     * @notice The maximum depth of the SMT tree
     */
    uint256 public immutable smtTreeMaxDepth;

    /**
     * @notice The voting information
     */
    VotingInfo public votingInfo;

    /**
     * @notice The commitments to ensure that no registration with the same identifier occurs
     */
    mapping(bytes32 => bool) public commitments;

    /**
     * @notice The nullifiers to prevent double voting
     */
    mapping(bytes32 => bool) public nullifies;

    /**
     * @notice The roots history to ensure that the root exists
     */
    mapping(bytes32 => bool) public rootsHistory;

    /**
     * @notice The votes per candidate
     */
    mapping(uint256 => uint256) public votesPerCandidate;

    /**
     * @notice The constructor of the Voting contract implementation.
     * All of the parameters are immutable therefore will be included to the bytecode.
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

        votingInfo.remark = votingParams_.remark;
        votingInfo.values.commitmentStartTime = votingParams_.commitmentStart;
        votingInfo.values.votingStartTime =
            votingParams_.commitmentStart +
            votingParams_.commitmentPeriod;
        votingInfo.values.votingEndTime =
            votingInfo.values.votingStartTime +
            votingParams_.votingPeriod;

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
            .RegisterProofInfo({registerProofParams: registerProofParams_, votingId: 0});

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

        emit UserRegistered(msg.sender, proveIdentityParams_, registerProofParams_, block.number);
    }

    /**
     * @inheritdoc IVoting
     */
    function vote(
        bytes32 root_,
        bytes32 nullifierHash_,
        uint256 voteId_,
        VerifierHelper.ProofPoints memory proof_
    ) external {
        require(
            getProposalStatus() == VotingStatus.PENDING,
            "Voting: the voting must be in the pending state to vote"
        );

        require(!nullifies[nullifierHash_], "Voting: nullifier already used");
        require(rootsHistory[root_], "Vote: root doesn't exist");

        require(
            voteVerifier.verifyProofSafe(
                [uint256(root_), uint256(nullifierHash_), voteId_, uint256(uint160(address(this)))]
                    .asDynamic(),
                proof_,
                4
            ),
            "Voting: Invalid vote proof"
        );

        nullifies[nullifierHash_] = true;

        votesPerCandidate[voteId_]++;

        emit UserVoted(msg.sender, root_, nullifierHash_, voteId_, block.number);
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
}
