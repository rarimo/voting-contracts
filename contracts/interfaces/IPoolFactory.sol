// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @title IPoolFactory Interface
 * @dev Defines the interface for a factory that creates new pool instances.
 */
interface IPoolFactory {
    /**
     * @notice Emitted when a new pool instance is created
     * @param poolType The type of the pool pool created
     * @param creator The address of the creator initiating the creation of the pool instance
     * @param pool The address of the newly created pool instance
     */
    event PoolCreated(string indexed poolType, address indexed creator, address indexed pool);

    /**
     * @notice Creates a new pool instance with specified parameters
     * @dev Deploys a new pool instance and registers it in the PoolRegistry.
     * @param poolType_ The type of the pool contract to be created
     * @param data_ The configuration parameters for the pool instance
     */
    function createPool(string memory poolType_, bytes calldata data_) external;

    /**
     * @notice Creates a new pool instance deterministically with specified parameters and a salt
     * @dev Deploys a new pool instance deterministically using CREATE2 and registers it in the PoolRegistry.
     * @param poolType_ The type of the pool contract to be created
     * @param data_ The configuration parameters for the pool instance
     * @param salt_ A unique salt to determine the address of the deployed contract
     */
    function createPoolWithSalt(
        string memory poolType_,
        bytes calldata data_,
        bytes32 salt_
    ) external;

    /**
     * @notice Predicts the address of a pool instance that would be deployed with the given parameters and salt
     * @param poolType_ The type of the pool pool to be created
     * @param proposer_ The address of the creator initiating the creation of the pool instance
     * @param salt_ The unique salt that would be used for deployment
     * @return The predicted address of the pool instance that would be created
     */
    function predictPoolAddress(
        string memory poolType_,
        address proposer_,
        bytes32 salt_
    ) external view returns (address);
}
