// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {Vector} from "@solarity/solidity-lib/libs/data-structures/memory/Vector.sol";

import {PoseidonUnit3L} from "@iden3/contracts/lib/Poseidon.sol";

import {IRegisterVerifier} from "../../interfaces/verifiers/IRegisterVerifier.sol";
import {IZKPQueriesStorage} from "../../interfaces/IZKPQueriesStorage.sol";
import {ILightweightState} from "../../interfaces/ILightweightState.sol";
import {IQueryMTPValidator} from "../../interfaces/IQueryMTPValidator.sol";

import {BaseVerifier} from "./BaseVerifier.sol";

/**
 * @title RegisterVerifier contract
 */
contract RegisterVerifier is IRegisterVerifier, BaseVerifier {
    using Vector for Vector.UintVector;

    string public constant REGISTER_PROOF_QUERY_ID = "REGISTER_PROOF";

    // documentNullifier => RegisterProofInfo
    mapping(uint256 => RegisterProofInfo) internal _registrationProofInfo;

    modifier onlyVoting(RegisterProofInfo memory registerProofInfo_) {
        _onlyVoting(registerProofInfo_);
        _;
    }

    function __RegisterVerifier_init(IZKPQueriesStorage zkpQueriesStorage_) external initializer {
        __BaseVerifier_init(zkpQueriesStorage_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function proveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) external onlyVoting(registerProofInfo_) {
        _proveRegistration(proveIdentityParams_, registerProofInfo_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function transitStateAndProveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_,
        TransitStateParams memory transitStateParams_
    ) external onlyVoting(registerProofInfo_) {
        _transitState(transitStateParams_);
        _proveRegistration(proveIdentityParams_, registerProofInfo_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function getRegisterProofInfo(
        uint256 documentNullifier_
    ) external view returns (RegisterProofInfo memory) {
        return _registrationProofInfo[documentNullifier_];
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function isIdentityRegistered(uint256 documentNullifier_) public view returns (bool) {
        return _registrationProofInfo[documentNullifier_].registerProofParams.commitment != 0;
    }

    function _proveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) internal {
        _verify(REGISTER_PROOF_QUERY_ID, proveIdentityParams_, registerProofInfo_);

        uint256 documentNullifier_ = registerProofInfo_.registerProofParams.documentNullifier;

        require(
            !isIdentityRegistered(documentNullifier_),
            "RegisterVerifier: Identity is already registered."
        );

        _registrationProofInfo[documentNullifier_] = registerProofInfo_;

        emit RegisterAccepted(documentNullifier_, registerProofInfo_);
    }

    function _verify(
        string memory queryId_,
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) internal view {
        require(
            zkpQueriesStorage.isQueryExists(queryId_),
            "RegisterVerifier: ZKP Query does not exist for passed query id."
        );

        IQueryMTPValidator queryValidator_ = IQueryMTPValidator(
            zkpQueriesStorage.getQueryValidator(queryId_)
        );

        IZKPQueriesStorage.CircuitQuery memory circuitQuery_ = zkpQueriesStorage
            .getStoredCircuitQuery(queryId_);

        uint256[] memory values_ = new uint256[](64);
        values_[0] = PoseidonUnit3L.poseidon(
            [
                1, // Is Adult should be always 1
                registerProofInfo_.registerProofParams.issuingAuthority,
                registerProofInfo_.registerProofParams.documentNullifier
            ]
        );

        circuitQuery_.values = values_;

        uint256 queryHash_ = zkpQueriesStorage.getQueryHash(circuitQuery_);

        _validateRegistrationFields(
            queryValidator_,
            proveIdentityParams_.inputs,
            registerProofInfo_
        );

        queryValidator_.verify(
            proveIdentityParams_.statesMerkleData,
            proveIdentityParams_.inputs,
            proveIdentityParams_.a,
            proveIdentityParams_.b,
            proveIdentityParams_.c,
            queryHash_
        );

        _checkAllowedIssuer(queryId_, proveIdentityParams_.statesMerkleData.issuerId);
    }

    /**
     * @dev The voting address is one of the inputs of the ZKP; therefore, we ensure that the caller is registered for
     * voting with the exact ID, which, by architecture, is the same as the voting address.
     */
    function _onlyVoting(RegisterProofInfo memory registerProofInfo_) private view {
        require(
            msg.sender == registerProofInfo_.votingAddress,
            "RegisterVerifier: the caller is not the voting contract."
        );
    }

    function _validateRegistrationFields(
        IQueryMTPValidator queryValidator_,
        uint256[] memory inputs_,
        RegisterProofInfo memory registerProofInfo_
    ) private pure {
        uint256 commitmentIndex_ = queryValidator_.getCommitmentIndex();
        uint256 votingAddressIndex_ = queryValidator_.getVotingAddressIndex();

        require(
            bytes32(inputs_[commitmentIndex_]) ==
                registerProofInfo_.registerProofParams.commitment,
            "RegisterVerifier: commitment does not match the requested one."
        );

        require(
            inputs_[votingAddressIndex_] == uint256(uint160(registerProofInfo_.votingAddress)),
            "RegisterVerifier: voting address does not match the requested one."
        );
    }
}
