// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IPoolFactory} from "./interfaces/IPoolFactory.sol";

import {PoolRegistry} from "./PoolRegistry.sol";

/**
 * @title PoolFactory contract
 */
contract PoolFactory is IPoolFactory, Initializable, UUPSUpgradeable {
    PoolRegistry public votingRegistry;

    modifier onlyExistingPoolType(string memory votingType_) {
        _requireExistingPoolType(votingType_);
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /**
     * @notice The function to initialize the PoolFactory.
     * @param votingRegistry_ The address of the PoolRegistry contract.
     *
     * It binds the PoolRegistry contract to the PoolFactory.
     */
    function __PoolFactory_init(address votingRegistry_) external initializer {
        votingRegistry = PoolRegistry(votingRegistry_);
    }

    /**
     * @inheritdoc IPoolFactory
     */
    function createPool(
        string memory votingType_,
        bytes memory data_
    ) external onlyExistingPoolType(votingType_) {
        address voting_ = _deploy(votingType_, data_);

        _register(votingType_, msg.sender, voting_);

        emit PoolCreated(votingType_, msg.sender, voting_);
    }

    /**
     * @inheritdoc IPoolFactory
     */
    function createPoolWithSalt(
        string memory votingType_,
        bytes memory data_,
        bytes32 salt_
    ) external onlyExistingPoolType(votingType_) {
        bytes32 combinedSalt_ = keccak256(abi.encodePacked(msg.sender, salt_));

        address pool_ = _deploy2(votingType_, new bytes(0), combinedSalt_);

        (bool success_, bytes memory returnData_) = pool_.call(data_);
        Address.verifyCallResult(success_, returnData_, "PoolFactory: failed to initialize pool");

        _register(votingType_, msg.sender, pool_);

        emit PoolCreated(votingType_, msg.sender, pool_);
    }

    /**
     * @inheritdoc IPoolFactory
     */
    function predictPoolAddress(
        string memory poolType_,
        address proposer_,
        bytes32 salt_
    ) external view returns (address) {
        bytes32 combinedSalt_ = keccak256(abi.encodePacked(proposer_, salt_));

        return _predictPoolAddress(poolType_, new bytes(0), combinedSalt_);
    }

    function _deploy(string memory poolType_, bytes memory data_) private returns (address) {
        return address(new ERC1967Proxy(votingRegistry.getPoolImplementation(poolType_), data_));
    }

    function _deploy2(
        string memory poolType_,
        bytes memory data_,
        bytes32 salt_
    ) private returns (address) {
        return
            address(
                new ERC1967Proxy{salt: salt_}(
                    votingRegistry.getPoolImplementation(poolType_),
                    data_
                )
            );
    }

    function _register(string memory poolType_, address proposer_, address poolProxy_) private {
        votingRegistry.addProxyPool(poolType_, proposer_, poolProxy_);
    }

    function _predictPoolAddress(
        string memory poolType_,
        bytes memory data_,
        bytes32 salt_
    ) private view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(votingRegistry.getPoolImplementation(poolType_), data_)
            )
        );

        return Create2.computeAddress(salt_, bytecodeHash);
    }

    function _requireExistingPoolType(string memory votingType_) private view {
        require(
            votingRegistry.getPoolImplementation(votingType_) != address(0),
            "PoolFactory: voting type does not exist"
        );
    }

    function _authorizeUpgrade(address) internal view override {
        require(
            msg.sender == OwnableUpgradeable(address(votingRegistry)).owner(),
            "PoolFactory: only registry owner can upgrade"
        );
    }
}
