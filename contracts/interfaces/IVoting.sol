// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IVotingPool} from "./IVotingPool.sol";
import {IRegistration} from "./IRegistration.sol";

/**
 * @title IVoting Interface
 * @dev Interface for the voting process, detailing the setup, registration for voting, casting votes, and querying voting status.
 */
interface IVoting is IVotingPool {
    /**
     * @notice Enumeration for voting status
     */
    enum VotingStatus {
        NONE, // No voting created
        NOT_STARTED, // Voting created but not started
        PENDING, // Active voting phase
        ENDED // Voting has concluded
    }

    /**
     * @notice Struct for voting parameters configuration
     * @param registration Address of the registration contract
     * @param remark Description or title of the voting event or voting metadata
     * @param votingStart Timestamp for the start of the voting phase
     * @param votingPeriod Duration in seconds of the voting phase
     * @param candidates List of candidate identifiers
     */
    struct VotingParams {
        IRegistration registration;
        string remark;
        uint256 votingStart;
        uint256 votingPeriod;
        bytes32[] candidates;
    }

    /**
     * @notice Struct for tracking voting phase timings
     * @param votingStartTime Start timestamp of the voting phase
     * @param votingEndTime End timestamp of the voting phase
     */
    struct VotingValues {
        uint256 votingStartTime;
        uint256 votingEndTime;
        bytes32[] candidates;
    }

    /**
     * @notice Struct for counting votes
     * @param votesCount Total number of votes cast
     */
    struct VotingCounters {
        uint256 votesCount;
    }

    /**
     * @notice Struct for detailed information about a voting
     * @param remark Title or description of the voting
     * @param values Timing information for the voting phases
     * @param counters Count of votes
     */
    struct VotingInfo {
        string remark;
        VotingValues values;
        VotingCounters counters;
    }

    /**
     * @notice Emitted when a new voting is initialized
     * @param proposer Address of the proposer initializing the voting. Usually the factory contract
     * @param votingParams Struct containing the parameters of the voting
     */
    event VotingInitialized(address indexed proposer, VotingParams votingParams);

    /**
     * @notice Emitted when a user casts a vote
     * @param user Address of the user voting
     * @param root Root of the SMT tree that was used at the time of voting
     * @param nullifierHash Hash of the nullifier to prevent double voting
     * @param candidate Identifier of the candidate voted for
     */
    event UserVoted(address indexed user, bytes32 root, bytes32 nullifierHash, bytes32 candidate);

    /**
     * @notice Initializes a new voting session with specified parameters
     * @param votingParams_ The parameters for the voting session, including start times, periods, and candidates.
     */
    function __Voting_init(VotingParams calldata votingParams_) external;

    /**
     * @notice Allows a registered user to cast a vote for a candidate
     * @dev Verifies the user's voting proof and updates the voting tally. Emits a UserVoted event upon success.
     * @param root_ The root of the SMT tree to verify the vote against.
     * @param nullifierHash_ The hash of the nullifier to prevent double voting.
     * @param candidate_ The identifier of the candidate being voted for.
     * @param proof_ The zk-SNARK proof points for the vote.
     */
    function vote(
        bytes32 root_,
        bytes32 nullifierHash_,
        bytes32 candidate_,
        VerifierHelper.ProofPoints memory proof_
    ) external;

    /**
     * @notice Retrieves the current status of the proposal
     */
    function getProposalStatus() external view returns (VotingStatus);
}
