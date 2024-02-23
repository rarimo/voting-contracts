// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {Paginator} from "@solarity/solidity-lib/libs/arrays/Paginator.sol";

import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";

/**
 * @title PoolRegistry contract
 */
contract PoolRegistry is IPoolRegistry, Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Paginator for EnumerableSet.AddressSet;

    address public poolFactory;

    // poolType => poolPool
    mapping(string => EnumerableSet.AddressSet) private _poolByType;

    // proposer => poolPool
    mapping(address => EnumerableSet.AddressSet) private _poolByAddress;

    // poolType => poolImplementation
    mapping(string => address) private _poolImplementations;

    modifier onlyEqualLength(string[] memory names_, address[] memory newImplementations_) {
        _requireEqualLength(names_, newImplementations_);
        _;
    }

    modifier onlyFactory() {
        _requireOnlyFactory();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice The function to initialize the PoolRegistry.
     * @param poolFactory_ The address of the PoolFactory contract.
     *
     * It binds the PoolFactory contract to the PoolRegistry.
     */
    function __PoolRegistry_init(address poolFactory_) external initializer {
        __Ownable_init();

        poolFactory = poolFactory_;
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function setNewImplementations(
        string[] memory names_,
        address[] memory newImplementations_
    ) external onlyOwner onlyEqualLength(names_, newImplementations_) {
        for (uint256 i = 0; i < names_.length; i++) {
            require(
                Address.isContract(newImplementations_[i]),
                "PoolRegistry: the implementation address is not a contract"
            );

            _poolImplementations[names_[i]] = newImplementations_[i];
        }
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function addProxyPool(
        string memory name_,
        address proposer_,
        address pool_
    ) external onlyFactory {
        _poolByType[name_].add(pool_);
        _poolByAddress[proposer_].add(pool_);
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function getPoolImplementation(string memory name_) external view returns (address) {
        return _poolImplementations[name_];
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function isPoolExistByType(string memory name_, address pool_) external view returns (bool) {
        return _poolByType[name_].contains(pool_);
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function isPoolExistByProposer(address proposer_, address pool_) external view returns (bool) {
        return _poolByAddress[proposer_].contains(pool_);
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function poolCountByType(string memory poolType_) external view returns (uint256) {
        return _poolByType[poolType_].length();
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function poolCountByProposer(address proposer_) external view returns (uint256) {
        return _poolByAddress[proposer_].length();
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function listPoolsByType(
        string memory name_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_) {
        return _poolByType[name_].part(offset_, limit_);
    }

    /**
     * @inheritdoc IPoolRegistry
     */
    function listPoolsByProposer(
        address proposer_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_) {
        return _poolByAddress[proposer_].part(offset_, limit_);
    }

    function _requireEqualLength(
        string[] memory names_,
        address[] memory newImplementations_
    ) private pure {
        require(
            names_.length == newImplementations_.length,
            "PoolRegistry: names and implementations length mismatch"
        );
    }

    function _requireOnlyFactory() private view {
        require(msg.sender == poolFactory, "PoolRegistry: only factory can call this function");
    }

    function _authorizeUpgrade(address) internal view override onlyOwner {}
}
