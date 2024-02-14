// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @title IVotingRegistry Interface
 * @dev Interface for the VotingRegistry, responsible for managing voting pool implementations and instances.
 */
interface IVotingRegistry {
    /**
     * @notice Sets or upgrades the implementations for specified voting pool types.
     *
     * @dev Only callable by the owner. Ensures names and implementations arrays are of equal length.
     *
     * @param names_ Array of names associated with voting pool types.
     * @param newImplementations_ Array of addresses for the new implementations of the corresponding voting pool types.
     */
    function setNewImplementations(
        string[] memory names_,
        address[] memory newImplementations_
    ) external;

    /**
     * @notice Adds a new proxy pool to the registry.
     *
     * @dev Only callable by the VotingFactory contract.
     *
     * @param name_ The name associated with the voting pool type.
     * @param proposer_ The address of the proposer creating the voting instance.
     * @param voting_ The proxy address of the new voting pool instance.
     */
    function addProxyPool(string memory name_, address proposer_, address voting_) external;

    /**
     * @notice Retrieves the implementation address for a specific voting type.
     * @param name_ The name of the voting type.
     * @return address The address of the implementation used for deploying future voting contracts of this type.
     */
    function getVotingImplementation(string memory name_) external view returns (address);

    /**
     * @notice Checks if a voting instance exists within a specific voting pool type.
     * @param name_ The name associated with the voting pool type.
     * @param voting_ The address of the voting instance to check.
     * @return bool True if the voting instance exists within the specified voting pool type, false otherwise.
     */
    function isVotingExist(string memory name_, address voting_) external view returns (bool);

    /**
     * @notice Checks if a voting instance exists within the pools created by a specific proposer.
     * @param proposer_ The address of the proposer to check against.
     * @param voting_ The address of the voting instance to check.
     * @return bool True if the voting instance exists within the pools created by the specified proposer, false otherwise.
     */
    function isVotingExist(address proposer_, address voting_) external view returns (bool);

    /**
     * @notice Counts the number of voting instances within a specific voting pool type.
     * @param votingType_ The name associated with the voting pool type.
     * @return uint256 The number of voting instances within the specified voting pool type.
     */
    function votingCountWithinPool(string memory votingType_) external view returns (uint256);

    /**
     * @notice Counts the number of voting instances created by a specific proposer.
     * @param proposer_ The address of the proposer.
     * @return uint256 The number of voting instances created by the specified proposer.
     */
    function votingCountWithinPool(address proposer_) external view returns (uint256);

    /**
     * @notice Lists voting pools by their type in a paginated manner.
     * @dev Utilize `votingCountWithinPool` with the same `name_` parameter for pagination management.
     * @param name_ The name associated with the voting pool type.
     * @param offset_ The starting index for pagination.
     * @param limit_ The maximum number of pool addresses to return.
     * @return pools_ Array of proxy addresses for the voting pools of the specified type.
     */
    function listPools(
        string memory name_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_);

    /**
     * @notice Lists voting pools created by a specific proposer in a paginated manner.
     * @dev Utilize `votingCountWithinPool` with the same `proposer_` parameter for pagination management.
     * @param proposer_ The address of the proposer.
     * @param offset_ The starting index for pagination.
     * @param limit_ The maximum number of pool addresses to return.
     * @return pools_ Array of proxy addresses for the voting pools created by the specified proposer.
     */
    function listPools(
        address proposer_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_);
}
