// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IBaseVerifier} from "./verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "./verifiers/IRegisterVerifier.sol";

/**
 * @title IVoting Interface
 * @dev Interface for the voting process, detailing the setup, registration for voting, casting votes, and querying voting status.
 */
interface IVoting {
    /**
     * @notice Enumeration for voting status
     */
    enum VotingStatus {
        NONE, // No voting created
        NOT_STARTED, // Voting created but not started
        COMMITMENT, // Commitment phase for registration
        PENDING, // Active voting phase
        ENDED // Voting has concluded
    }

    /**
     * @notice Struct for voting parameters configuration
     * @param remark Description or title of the voting event or voting metadata
     * @param commitmentStart Timestamp for the start of the registration phase
     * @param commitmentPeriod Duration in seconds of the registration phase
     * @param votingPeriod Duration in seconds of the voting phase
     * @param candidates List of candidate identifiers
     */
    struct VotingParams {
        string remark;
        uint256 commitmentStart;
        uint256 commitmentPeriod;
        uint256 votingPeriod;
        bytes32[] candidates;
    }

    /**
     * @notice Struct for tracking voting phase timings
     * @param commitmentStartTime Start timestamp of the registration phase
     * @param votingStartTime Start timestamp of the voting phase
     * @param votingEndTime End timestamp of the voting phase
     */
    struct VotingValues {
        uint256 commitmentStartTime;
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
     * @notice Emitted when a user successfully registers for voting
     * @param user Address of the user registering
     * @param proveIdentityParams Parameters used for proving the user's identity
     * @param registerProofParams Parameters used for the registration proof
     */
    event UserRegistered(
        address indexed user,
        IBaseVerifier.ProveIdentityParams proveIdentityParams,
        IRegisterVerifier.RegisterProofParams registerProofParams
    );

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
     * @notice Registers a user for voting, verifying their identity and registration proof
     * @dev Requires the voting to be in the commitment phase. Emits a UserRegistered event upon success.
     * @param proveIdentityParams_ Parameters to prove the user's identity.
     * @param registerProofParams_ Parameters for the user's registration proof.
     * @param transitStateParams_ Parameters for state transition, if applicable.
     * @param isTransitState_ Flag indicating whether a state transition is required.
     */
    function registerForVoting(
        IBaseVerifier.ProveIdentityParams memory proveIdentityParams_,
        IRegisterVerifier.RegisterProofParams memory registerProofParams_,
        IBaseVerifier.TransitStateParams memory transitStateParams_,
        bool isTransitState_
    ) external;

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
