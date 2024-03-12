// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import {SetHelper} from "@solarity/solidity-lib/libs/arrays/SetHelper.sol";
import {Paginator} from "@solarity/solidity-lib/libs/arrays/Paginator.sol";
import {Vector} from "@solarity/solidity-lib/libs/data-structures/memory/Vector.sol";

import {PoseidonUnit3L} from "@iden3/contracts/lib/Poseidon.sol";

import {IRegisterVerifier} from "../../interfaces/iden3/verifiers/IRegisterVerifier.sol";
import {IZKPQueriesStorage} from "../../interfaces/iden3/IZKPQueriesStorage.sol";
import {ILightweightState} from "../../interfaces/iden3/ILightweightState.sol";
import {IQueryMTPValidator} from "../../interfaces/iden3/validators/IQueryMTPValidator.sol";

import {BaseVerifier} from "./BaseVerifier.sol";

/**
 * @title RegisterVerifier contract
 */
contract RegisterVerifier is IRegisterVerifier, BaseVerifier {
    using Vector for Vector.UintVector;

    using SetHelper for EnumerableSet.UintSet;
    using Paginator for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.UintSet;

    string public constant REGISTER_PROOF_QUERY_ID = "REGISTER_PROOF";

    EnumerableSet.UintSet internal _issuingAuthorityWhitelist;
    EnumerableSet.UintSet internal _issuingAuthorityBlacklist;

    // registrationContract => documentNullifier => RegisterProofInfo
    mapping(address => mapping(uint256 => RegisterProofInfo)) private _registrationProofInfo;

    modifier onlyRegistrationContract(RegisterProofInfo memory registerProofInfo_) {
        _onlyRegistrationContract(registerProofInfo_);
        _;
    }

    function __RegisterVerifier_init(
        IZKPQueriesStorage zkpQueriesStorage_,
        uint256[] memory issuingAuthorityWhitelist_,
        uint256[] memory issuingAuthorityBlacklist_
    ) external initializer {
        __BaseVerifier_init(zkpQueriesStorage_);

        _issuingAuthorityWhitelist.add(issuingAuthorityWhitelist_);
        _issuingAuthorityBlacklist.add(issuingAuthorityBlacklist_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function proveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) external onlyRegistrationContract(registerProofInfo_) {
        _proveRegistration(proveIdentityParams_, registerProofInfo_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function transitStateAndProveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_,
        TransitStateParams memory transitStateParams_
    ) external onlyRegistrationContract(registerProofInfo_) {
        _transitState(transitStateParams_);
        _proveRegistration(proveIdentityParams_, registerProofInfo_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function getRegisterProofInfo(
        address registrationContract_,
        uint256 documentNullifier_
    ) external view returns (RegisterProofInfo memory) {
        return _registrationProofInfo[registrationContract_][documentNullifier_];
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function isIdentityRegistered(
        address registrationContract_,
        uint256 documentNullifier_
    ) public view returns (bool) {
        return
            _registrationProofInfo[registrationContract_][documentNullifier_]
                .registerProofParams
                .commitment != 0;
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function isIssuingAuthorityWhitelisted(uint256 issuingAuthority_) public view returns (bool) {
        return _issuingAuthorityWhitelist.contains(issuingAuthority_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function isIssuingAuthorityBlacklisted(uint256 issuingAuthority_) public view returns (bool) {
        return _issuingAuthorityBlacklist.contains(issuingAuthority_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function countIssuingAuthorityWhitelist() external view returns (uint256) {
        return _issuingAuthorityWhitelist.length();
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function countIssuingAuthorityBlacklist() external view returns (uint256) {
        return _issuingAuthorityBlacklist.length();
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function listIssuingAuthorityWhitelist(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256[] memory) {
        return _issuingAuthorityWhitelist.part(offset_, limit_);
    }

    /**
     * @inheritdoc IRegisterVerifier
     */
    function listIssuingAuthorityBlacklist(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256[] memory) {
        return _issuingAuthorityBlacklist.part(offset_, limit_);
    }

    function _proveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) internal {
        _verify(REGISTER_PROOF_QUERY_ID, proveIdentityParams_, registerProofInfo_);

        address registrationContract_ = registerProofInfo_.registrationContractAddress;
        uint256 documentNullifier_ = registerProofInfo_.registerProofParams.documentNullifier;

        require(
            !isIdentityRegistered(registrationContract_, documentNullifier_),
            "RegisterVerifier: Identity is already registered."
        );

        _registrationProofInfo[registrationContract_][documentNullifier_] = registerProofInfo_;

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

        uint256[] memory values_ = new uint256[](1);
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
     * @dev The registration address is one of the inputs of the ZKP; therefore, we ensure that
     * the caller is registered with the exact ID, which, by design, is the same as the registration contract address.
     */
    function _onlyRegistrationContract(RegisterProofInfo memory registerProofInfo_) private view {
        require(
            msg.sender == registerProofInfo_.registrationContractAddress,
            "RegisterVerifier: the caller is not the voting contract."
        );
    }

    function _validateRegistrationFields(
        IQueryMTPValidator queryValidator_,
        uint256[] memory inputs_,
        RegisterProofInfo memory registerProofInfo_
    ) private view {
        uint256 issuingAuthority_ = registerProofInfo_.registerProofParams.issuingAuthority;

        require(
            !isIssuingAuthorityBlacklisted(issuingAuthority_),
            "RegisterVerifier: Issuing authority is blacklisted."
        );

        require(
            _issuingAuthorityWhitelist.length() == 0 ||
                isIssuingAuthorityWhitelisted(issuingAuthority_),
            "RegisterVerifier: Issuing authority is not whitelisted."
        );

        uint256 commitmentIndex_ = queryValidator_.getCommitmentIndex();
        uint256 registrationAddressIndex_ = queryValidator_.getRegistrationAddressIndex();

        require(
            bytes32(inputs_[commitmentIndex_]) ==
                registerProofInfo_.registerProofParams.commitment,
            "RegisterVerifier: commitment does not match the requested one."
        );

        require(inputs_[commitmentIndex_] != 0, "RegisterVerifier: commitment should not be zero");

        require(
            inputs_[registrationAddressIndex_] ==
                uint256(uint160(registerProofInfo_.registrationContractAddress)),
            "RegisterVerifier: registration address does not match the requested one."
        );
    }
}
