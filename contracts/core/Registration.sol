// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IRegistration} from "../interfaces/core/IRegistration.sol";
import {IBaseVerifier} from "../interfaces/iden3/verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "../interfaces/iden3/verifiers/IRegisterVerifier.sol";

import {PoseidonSMT} from "../utils/PoseidonSMT.sol";

/**
 * @title Registration Contract
 * @dev Implements a registration system with zk-SNARKs for privacy and integrity, and a Merkle tree for registration tracking.
 */
contract Registration is IRegistration, PoseidonSMT, Initializable {
    /// The contract for registration proof verification
    IRegisterVerifier public immutable registerVerifier;

    /// The maximum depth of the Sparse Merkle Tree (SMT)
    uint256 public immutable smtTreeMaxDepth;

    /// Struct containing all relevant registration information
    RegistrationInfo public registrationInfo;

    /// Mapping to track commitments and prevent duplicate registrations
    mapping(bytes32 => bool) public commitments;

    /// Mapping to track roots and validate their existence
    mapping(bytes32 => bool) public rootsHistory;

    /**
     * @notice Initializes a new Registration contract with specified verifiers and SMT tree depth.
     * @param registerVerifier_ Address of the registration proof verifier contract.
     * @param treeHeight_ Maximum depth of the SMT used for registration tracking.
     */
    constructor(address registerVerifier_, uint256 treeHeight_) {
        registerVerifier = IRegisterVerifier(registerVerifier_);

        smtTreeMaxDepth = treeHeight_;

        _disableInitializers();
    }

    /**
     * @inheritdoc IRegistration
     */
    function __Registration_init(
        RegistrationParams calldata registrationParams_
    ) external initializer {
        __PoseidonSMT_init(smtTreeMaxDepth);

        _validateRegistrationParams(registrationParams_);

        registrationInfo.remark = registrationParams_.remark;
        registrationInfo.values.commitmentStartTime = registrationParams_.commitmentStart;
        registrationInfo.values.commitmentEndTime =
            registrationParams_.commitmentStart +
            registrationParams_.commitmentPeriod;

        emit RegistrationInitialized(msg.sender, registrationParams_);
    }

    /**
     * @inheritdoc IRegistration
     */
    function register(
        IBaseVerifier.ProveIdentityParams memory proveIdentityParams_,
        IRegisterVerifier.RegisterProofParams memory registerProofParams_,
        IBaseVerifier.TransitStateParams memory transitStateParams_,
        bool isTransitState_
    ) external {
        require(
            getRegistrationStatus() == RegistrationStatus.COMMITMENT,
            "Registration: the registration must be in the commitment state"
        );

        bytes32 commitment_ = registerProofParams_.commitment;

        require(!commitments[commitment_], "Registration: commitment already exists");

        IRegisterVerifier.RegisterProofInfo memory registerProofInfo_ = IRegisterVerifier
            .RegisterProofInfo({
                registerProofParams: registerProofParams_,
                registrationContractAddress: address(this)
            });

        if (isTransitState_) {
            registerVerifier.transitStateAndProveRegistration(
                proveIdentityParams_,
                registerProofInfo_,
                transitStateParams_
            );
        } else {
            registerVerifier.proveRegistration(proveIdentityParams_, registerProofInfo_);
        }

        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;
        registrationInfo.counters.totalRegistrations++;

        emit UserRegistered(msg.sender, proveIdentityParams_, registerProofParams_);
    }

    /**
     * @inheritdoc IRegistration
     */
    function isRootExists(bytes32 root) external view returns (bool) {
        return rootsHistory[root];
    }

    /**
     * @inheritdoc IRegistration
     */
    function getRegistrationInfo() external view returns (RegistrationInfo memory) {
        return registrationInfo;
    }

    /**
     * @inheritdoc IRegistration
     */
    function getRegistrationStatus() public view returns (RegistrationStatus) {
        if (registrationInfo.values.commitmentStartTime == 0) {
            return RegistrationStatus.NONE;
        }

        if (block.timestamp < registrationInfo.values.commitmentStartTime) {
            return RegistrationStatus.NOT_STARTED;
        }

        if (block.timestamp < registrationInfo.values.commitmentEndTime) {
            return RegistrationStatus.COMMITMENT;
        }

        return RegistrationStatus.ENDED;
    }

    /**
     * @inheritdoc IRegistration
     */
    function isUserRegistered(uint256 documentNullifier_) external view returns (bool) {
        return registerVerifier.isIdentityRegistered(address(this), documentNullifier_);
    }

    function _validateRegistrationParams(
        RegistrationParams calldata registrationParams_
    ) internal view {
        require(
            registrationParams_.commitmentStart > block.timestamp,
            "Registration: commitment start must be in the future"
        );
        require(
            registrationParams_.commitmentPeriod > 0,
            "Registration: commitment period must be greater than 0"
        );
    }
}
