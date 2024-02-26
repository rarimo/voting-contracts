// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @title IVotingRegistry Interface
 * @dev Interface for the VotingRegistry, responsible for managing pool implementations and instances.
 *
 * Right now it supports following types:
 * - "Simple Voting": interface is IVoting
 * - "Simple Registration": interface is IRegistration
 */
interface IVotingRegistry {
    /**
     * @notice Sets or upgrades the implementations for specified pool types.
     *
     * @dev Only callable by the owner. Ensures names and implementations arrays are of equal length.
     *
     * @param poolTypes_ Array of names associated with pool types.
     * @param newImplementations_ Array of addresses for the new implementations of the corresponding pool types.
     */
    function setNewImplementations(
        string[] memory poolTypes_,
        address[] memory newImplementations_
    ) external;

    /**
     * @notice Adds a new proxy pool to the registry.
     *
     * @dev Only callable by the `VotingFactory` contract.
     *
     * @param poolType_ The name associated with the pool type.
     * @param proposer_ The address of the proposer creating the pool instance.
     * @param pool_ The proxy address of the new pool pool instance.
     */
    function addProxyPool(string memory poolType_, address proposer_, address pool_) external;

    /**
     * @notice Binds a voting contract to a registration contract.
     *
     * @dev Only callable by the `VotingFactory` contract.
     *
     * @param proposer_ The address of the proposer who created the registration contract.
     * @param voting_ The address of the voting contract.
     * @param registration_ The address of the registration contract.
     */
    function bindVotingToRegistration(
        address proposer_,
        address voting_,
        address registration_
    ) external;

    /**
     * @notice Retrieves the implementation address for a specific pool type.
     * @param poolType_ The name of the pool type.
     * @return address The address of the implementation used for deploying future pool contracts of this type.
     */
    function getPoolImplementation(string memory poolType_) external view returns (address);

    /**
     * @notice Retrieves the voting contract address for a specific registration contract.
     * @param proposer_ The address of the proposer who created the registration contract.
     * @param registration_ The address of the registration contract.
     * @return address The address of the voting contract associated with the specified registration contract.
     * Zero address if no voting contract is associated with the registration contract.
     */
    function getVotingForRegistration(
        address proposer_,
        address registration_
    ) external view returns (address);

    /**
     * @notice Checks if a pool instance exists within a specific pool pool type.
     * @param poolType_ The name associated with the pool pool type.
     * @param pool_ The address of the pool instance to check.
     * @return bool True if the pool instance exists within the specified pool pool type, false otherwise.
     */
    function isPoolExistByType(
        string memory poolType_,
        address pool_
    ) external view returns (bool);

    /**
     * @notice Checks if a pool instance exists within the pools created by a specific proposer.
     * @param proposer_ The address of the proposer to check against.
     * @param pool_ The address of the pool instance to check.
     * @return bool True if the pool instance exists within the pools created by the specified proposer, false otherwise.
     */
    function isPoolExistByProposer(address proposer_, address pool_) external view returns (bool);

    /**
     * @notice Checks if a pool instance exists within the pools created by a specific proposer and pool type.
     * @param proposer_ The address of the proposer to check against.
     * @param poolType_ The name associated with the pool pool type.
     * @param pool_ The address of the pool instance to check.
     * @return bool True if the pool instance exists within the pools created by the specified proposer and pool type, false otherwise.
     */
    function isPoolExistByProposerAndType(
        address proposer_,
        string memory poolType_,
        address pool_
    ) external view returns (bool);

    /**
     * @notice Counts the number of pool instances within a specific pool pool type.
     * @param poolType_ The name associated with the pool pool type.
     * @return uint256 The number of pool instances within the specified pool pool type.
     */
    function poolCountByType(string memory poolType_) external view returns (uint256);

    /**
     * @notice Counts the number of pool instances created by a specific proposer.
     * @param proposer_ The address of the proposer.
     * @return uint256 The number of pool instances created by the specified proposer.
     */
    function poolCountByProposer(address proposer_) external view returns (uint256);

    /**
     * @notice Counts the number of pool instances created by a specific proposer and pool type.
     * @param proposer_ The address of the proposer.
     * @param poolType_ The name associated with the pool pool type.
     * @return uint256 The number of pool instances created by the specified proposer and pool type.
     */
    function poolCountByProposerAndType(
        address proposer_,
        string memory poolType_
    ) external view returns (uint256);

    /**
     * @notice Lists pool pools by their type in a paginated manner.
     * @dev Utilize `poolCountByType` with the same `name_` parameter for pagination management.
     * @param poolType_ The name associated with the pool pool type.
     * @param offset_ The starting index for pagination.
     * @param limit_ The maximum number of pool addresses to return.
     * @return pools_ Array of proxy addresses for the pool pools of the specified type.
     */
    function listPoolsByType(
        string memory poolType_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_);

    /**
     * @notice Lists pool pools created by a specific proposer in a paginated manner.
     * @dev Utilize `poolCountByProposer` with the same `proposer_` parameter for pagination management.
     * @param proposer_ The address of the proposer.
     * @param offset_ The starting index for pagination.
     * @param limit_ The maximum number of pool addresses to return.
     * @return pools_ Array of proxy addresses for the pool pools created by the specified proposer.
     */
    function listPoolsByProposer(
        address proposer_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_);

    /**
     * @notice Lists pool pools created by a specific proposer and pool type in a paginated manner.
     * @dev Utilize `poolCountByProposerAndType` with the same `proposer_` and `name_` parameters for pagination management.
     * @param proposer_ The address of the proposer.
     * @param poolType_ The name associated with the pool pool type.
     * @param offset_ The starting index for pagination.
     * @param limit_ The maximum number of pool addresses to return.
     * @return pools_ Array of proxy addresses for the pool pools created by the specified proposer and pool type.
     */
    function listPoolsByProposerAndType(
        address proposer_,
        string memory poolType_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_);
}
