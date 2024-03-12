// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";
import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IVoting} from "../interfaces/core/IVoting.sol";
import {IVotingPool} from "../interfaces/core/IVotingPool.sol";
import {IRegistration} from "../interfaces/core/IRegistration.sol";
import {IBaseVerifier} from "../interfaces/iden3/verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "../interfaces/iden3/verifiers/IRegisterVerifier.sol";

/**
 * @title Voting Contract
 * @dev Implements a voting system with registration and voting phases, utilizing zk-SNARKs for privacy and integrity, and a Merkle tree for vote tracking.
 */
contract Voting is IVoting, ERC165, Initializable {
    using TypeCaster for *; // TypeCaster library for type conversions.
    using VerifierHelper for address; // VerifierHelper library for zk-SNARK proof verification.

    uint256 public constant MAX_CANDIDATES = 100;

    /// The contract for voting proof verification
    address public immutable voteVerifier;

    /// The contract for validation of registration
    IRegistration public registration;

    /// Struct containing all relevant voting information
    VotingInfo public votingInfo;

    /// Mapping to track nullifiers and prevent double voting
    mapping(bytes32 => bool) public nullifiers;

    /// Mapping of candidates available for voting
    mapping(bytes32 => bool) public candidates;

    /// Mapping to track votes per candidate
    mapping(bytes32 => uint256) public votesPerCandidate;

    /**
     * @notice Initializes a new Voting contract with specified verifier.
     * @param voteVerifier_ Address of the voting proof verifier contract.
     */
    constructor(address voteVerifier_) {
        voteVerifier = voteVerifier_;

        _disableInitializers();
    }

    /**
     * @inheritdoc IVoting
     */
    function __Voting_init(VotingParams calldata votingParams_) external initializer {
        registration = votingParams_.registration;

        _validateVotingParams(votingParams_);

        votingInfo.remark = votingParams_.remark;
        votingInfo.values.votingStartTime = votingParams_.votingStart;
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
        require(registration.isRootExists(root_), "Voting: root doesn't exist");
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
        if (votingInfo.values.votingStartTime == 0) {
            return VotingStatus.NONE;
        }

        if (block.timestamp < votingInfo.values.votingStartTime) {
            return VotingStatus.NOT_STARTED;
        }

        if (block.timestamp < votingInfo.values.votingEndTime) {
            return VotingStatus.PENDING;
        }

        return VotingStatus.ENDED;
    }

    function getRegistrationAddresses() external view returns (address[] memory) {
        return address(registration).asSingletonArray();
    }

    /**
     * @inheritdoc ERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IVotingPool).interfaceId ||
            interfaceId == type(IVoting).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _validateVotingParams(VotingParams calldata votingParams_) internal view {
        require(
            votingParams_.votingStart > block.timestamp,
            "Voting: voting start must be in the future"
        );
        require(
            address(votingParams_.registration) != address(0),
            "Voting: registration contract must be provided"
        );
        require(votingParams_.votingPeriod > 0, "Voting: voting period must be greater than 0");
        require(votingParams_.candidates.length > 0, "Voting: candidates must be provided");
        require(votingParams_.candidates.length <= MAX_CANDIDATES, "Voting: too many candidates");

        IRegistration.RegistrationInfo memory registrationInfo = registration
            .getRegistrationInfo();
        require(
            registrationInfo.values.commitmentEndTime < votingParams_.votingStart,
            "Voting: voting start must be after registration end"
        );
    }
}
