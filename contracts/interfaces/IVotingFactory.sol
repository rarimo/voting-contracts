// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @title IVotingFactory Interface
 * @dev Defines the interface for a factory that creates new voting and registration instances.
 */
interface IVotingFactory {
    /**
     * @notice Emitted when a new instance is created
     * @param instanceType The type of the instance created
     * @param creator The address of the creator initiating the creation of the instance
     * @param voting The address of the newly created instance
     */
    event InstanceCreated(
        string indexed instanceType,
        address indexed creator,
        address indexed voting
    );

    /**
     * @notice Creates a new registration instance with specified parameters
     * @dev Deploys a new registration instance and registers it in the RegistrationRegistry.
     * @param registrationType_ The type of the registration contract to be created
     * @param data_ The configuration parameters for the registration instance
     */
    function createRegistration(string memory registrationType_, bytes memory data_) external;

    /**
     * @notice Creates a new registration instance deterministically with specified parameters and a salt
     * @dev Deploys a new registration instance deterministically using CREATE2 and registers it in the RegistrationRegistry.
     * @param registrationType_ The type of the registration contract to be created
     * @param data_ The configuration parameters for the registration instance
     * @param salt_ A unique salt to determine the address of the deployed contract
     */
    function createRegistrationWithSalt(
        string memory registrationType_,
        bytes memory data_,
        bytes32 salt_
    ) external;

    /**
     * @notice Creates a new voting instance with specified parameters
     * @dev Deploys a new voting instance and registers it in the VotingRegistry.
     * @param votingType_ The type of the voting contract to be created
     * @param data_ The configuration parameters for the voting instance
     */
    function createVoting(string memory votingType_, bytes memory data_) external;

    /**
     * @notice Creates a new voting instance deterministically with specified parameters and a salt
     * @dev Deploys a new voting instance deterministically using CREATE2 and registers it in the VotingRegistry.
     * @param votingType_ The type of the voting contract to be created
     * @param data_ The configuration parameters for the voting instance
     * @param salt_ A unique salt to determine the address of the deployed contract
     */
    function createVotingWithSalt(
        string memory votingType_,
        bytes memory data_,
        bytes32 salt_
    ) external;

    /**
     * @notice Predicts the address of an instance that would be deployed with the given parameters and salt
     * @param type_ The type of the instance to be created
     * @param proposer_ The address of the creator initiating the creation of the instance
     * @param salt_ The unique salt that would be used for deployment
     * @return The predicted address of the instance that would be created
     */
    function predictAddress(
        string memory type_,
        address proposer_,
        bytes32 salt_
    ) external view returns (address);
}
