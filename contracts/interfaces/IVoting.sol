// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {VerifierHelper} from "@solarity/solidity-lib/libs/zkp/snarkjs/VerifierHelper.sol";

import {IBaseVerifier} from "./verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "./verifiers/IRegisterVerifier.sol";

/**
 * @title IVoting
 */
interface IVoting {
    enum VotingStatus {
        NONE,
        NOT_STARTED,
        COMMITMENT,
        PENDING,
        ENDED
    }

    /**
     * @notice Stores the configuration parameters for a DAO voting situation.
     * @param remark A brief description or title of the voting.
     * @param commitmentStart The start time of the commitment phase.
     * @param commitmentStart The start time of the commitment period.
     * @param votingPeriod Duration of the voting period.
     */
    struct VotingParams {
        string remark;
        uint256 commitmentStart;
        uint256 commitmentPeriod;
        uint256 votingPeriod;
    }

    /**
     * @notice Stores parameters for a voting instance.
     * @param commitmentStartTime Timestamp for the start of the commitment period.
     * @param votingStartTime Timestamp for the start of the voting period.
     * @param votingEndTime Timestamp for the end of the voting period.
     */
    struct VotingValues {
        uint256 commitmentStartTime;
        uint256 votingStartTime;
        uint256 votingEndTime;
    }

    /**
     * @notice Represents the counters for voting activities on a voting.
     * @param votesCount The total number of votes.
     */
    struct VotingCounters {
        uint256 votesCount;
    }

    /**
     * @notice Represents a voting structure.
     * @param remark A brief description or title of the voting.
     * @param params The voting parameters.
     * @param counters The voting counters.
     */
    struct VotingInfo {
        string remark;
        VotingValues values;
        VotingCounters counters;
    }

    event VotingInitialized(address proposer, VotingParams votingParams);
    event UserRegistered(
        address user,
        IBaseVerifier.ProveIdentityParams proveIdentityParams,
        IRegisterVerifier.RegisterProofParams registerProofParams,
        uint256 blockNumber
    );
    event UserVoted(
        address user,
        bytes32 root,
        bytes32 nullifierHash,
        uint256 voteId,
        uint256 blockNumber
    );

    /**
     * @notice The function to start the voting process.
     * Is used by the factory contract to create votings.
     *
     * @param votingParams_ The voting parameters.
     */
    function __Voting_init(VotingParams calldata votingParams_) external;

    /**
     * @notice The function to register for voting.
     * @param proveIdentityParams_ The parameters to prove the identity.
     * @param registerProofParams_ The parameters to prove the registration.
     * @param transitStateParams_ The parameters to transit the state.
     * @param isTransitState_ The flag to transit the state.
     */
    function registerForVoting(
        IBaseVerifier.ProveIdentityParams memory proveIdentityParams_,
        IRegisterVerifier.RegisterProofParams memory registerProofParams_,
        IBaseVerifier.TransitStateParams memory transitStateParams_,
        bool isTransitState_
    ) external;

    /**
     * @notice The function to vote.
     * @param root_ The root of the SMT tree.
     * @param nullifierHash_ The nullifier hash.
     * @param voteId_ The vote identifier.
     * @param proof_ The proof points.
     */
    function vote(
        bytes32 root_,
        bytes32 nullifierHash_,
        uint256 voteId_,
        VerifierHelper.ProofPoints memory proof_
    ) external;

    /**
     * @notice The function to get the proposal status.
     */
    function getProposalStatus() external view returns (VotingStatus);
}
