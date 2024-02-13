// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {Paginator} from "@solarity/solidity-lib/libs/arrays/Paginator.sol";

import {IVotingRegistry} from "./interfaces/IVotingRegistry.sol";

/**
 * @title VotingRegistry
 */
contract VotingRegistry is IVotingRegistry, Initializable, OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Paginator for EnumerableSet.AddressSet;

    address public votingFactory;

    // votingType => votingPool
    mapping(string => EnumerableSet.AddressSet) private _votingPools;

    // votingType => votingImplementation
    mapping(string => address) private _votingImplementations;

    modifier onlyEqualLength(string[] memory names_, address[] memory newImplementations_) {
        _requireEqualLength(names_, newImplementations_);
        _;
    }

    modifier onlyFactory() {
        _requireOnlyFactory();
        _;
    }

    /**
     * @notice The function to initialize the VotingRegistry.
     * @param votingFactory_ The address of the VotingFactory contract.
     *
     * It binds the VotingFactory contract to the VotingRegistry.
     */
    function __VotingRegistry_init(address votingFactory_) external initializer {
        __Ownable_init();

        votingFactory = votingFactory_;
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function setNewImplementations(
        string[] memory names_,
        address[] memory newImplementations_
    ) external onlyOwner onlyEqualLength(names_, newImplementations_) {
        for (uint256 i = 0; i < names_.length; i++) {
            require(
                Address.isContract(newImplementations_[i]),
                "VotingRegistry: the implementation address is not a contract"
            );

            _votingImplementations[names_[i]] = newImplementations_[i];
        }
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function addProxyPool(string memory name_, address voting_) external onlyFactory {
        _votingPools[name_].add(voting_);
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function getVotingImplementation(string memory name_) external view returns (address) {
        return _votingImplementations[name_];
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function isVotingExist(string memory name_, address voting_) external view returns (bool) {
        return _votingPools[name_].contains(voting_);
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function votingCountWithinPool(string memory votingType_) external view returns (uint256) {
        return _votingPools[votingType_].length();
    }

    /**
     * @inheritdoc IVotingRegistry
     */
    function listPools(
        string memory name_,
        uint256 offset_,
        uint256 limit_
    ) external view returns (address[] memory pools_) {
        return _votingPools[name_].part(offset_, limit_);
    }

    function _requireEqualLength(
        string[] memory names_,
        address[] memory newImplementations_
    ) private pure {
        require(
            names_.length == newImplementations_.length,
            "VotingRegistry: names and implementations length mismatch"
        );
    }

    function _requireOnlyFactory() private view {
        require(
            msg.sender == votingFactory,
            "VotingRegistry: only factory can call this function"
        );
    }
}
