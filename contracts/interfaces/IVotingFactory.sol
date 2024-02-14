// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IVoting} from "./IVoting.sol";

/**
 * @title IVotingFactory Interface
 * @dev Defines the interface for a factory that creates new voting instances.
 */
interface IVotingFactory {
    /**
     * @notice Emitted when a new voting instance is created
     * @param poolType The type of the voting pool created
     * @param creator The address of the creator initiating the creation of the voting instance
     * @param voting The address of the newly created voting instance
     */
    event VotingCreated(string indexed poolType, address indexed creator, address indexed voting);

    /**
     * @notice Creates a new voting instance with specified parameters
     * @dev Deploys a new voting instance and registers it in the VotingRegistry.
     * @param votingType_ The type of the voting contract to be created
     * @param votingParams_ The configuration parameters for the voting
     */
    function createVoting(
        string memory votingType_,
        IVoting.VotingParams calldata votingParams_
    ) external;

    /**
     * @notice Creates a new voting instance deterministically with specified parameters and a salt
     * @dev Deploys a new voting instance deterministically using CREATE2 and registers it in the VotingRegistry.
     * @param votingType_ The type of the voting contract to be created
     * @param votingParams_ The configuration parameters for the voting
     * @param salt_ A unique salt to determine the address of the deployed contract
     */
    function createVoting(
        string memory votingType_,
        IVoting.VotingParams calldata votingParams_,
        bytes32 salt_
    ) external;

    /**
     * @notice Predicts the address of a voting instance that would be deployed with the given parameters and salt
     * @param poolType_ The type of the voting pool to be created
     * @param votingParams_ The configuration parameters for the voting
     * @param salt_ The unique salt that would be used for deployment
     * @return The predicted address of the voting instance that would be created
     */
    function predictVotingAddress(
        string memory poolType_,
        IVoting.VotingParams calldata votingParams_,
        bytes32 salt_
    ) external view returns (address);
}
