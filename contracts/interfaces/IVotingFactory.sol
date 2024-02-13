// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IVoting} from "./IVoting.sol";

/**
 * @title IVotingFactory
 */
interface IVotingFactory {
    event VotingCreated(string indexed poolType, address indexed creator, address indexed voting);

    /**
     * @notice The function to create a new voting instance.
     * @param votingType_ The type of the voting contract.
     * @param votingParams_ The parameters for the voting.
     *
     * It deploys a new voting instance and registers it in the VotingRegistry.
     */
    function createVoting(
        string memory votingType_,
        IVoting.VotingParams calldata votingParams_
    ) external;

    /**
     * @notice The function to deploy a new voting instance deterministically.
     * @param votingType_ The type of the voting contract.
     * @param votingParams_ The parameters for the voting.
     * @param salt_ The salt for the deterministic deployment.
     *
     * It deploys a new voting instance deterministically and registers it in the VotingRegistry.
     */
    function createVoting(
        string memory votingType_,
        IVoting.VotingParams calldata votingParams_,
        bytes32 salt_
    ) external;

    /**
     * @notice The view function to predict the address of the voting instance if deployed via createVoting function with salt.
     */
    function predictVotingAddress(
        string memory poolType_,
        IVoting.VotingParams calldata votingParams_,
        bytes32 salt_
    ) external view returns (address);
}
