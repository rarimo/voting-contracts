// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IBaseVerifier} from "./IBaseVerifier.sol";
import {ILightweightState} from "../ILightweightState.sol";

interface IRegisterVerifier is IBaseVerifier {
    struct RegisterProofParams {
        bool isAdult;
        uint256 issuingAuthority;
        uint256 documentNullifier;
        bytes32 commitment;
    }

    struct RegisterProofInfo {
        RegisterProofParams registerProofParams;
        address votingAddress;
    }

    event RegisterAccepted(uint256 identityId, RegisterProofInfo registerProofInfo);

    function proveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) external;

    function transitStateAndProveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_,
        TransitStateParams memory transitStateParams_
    ) external;

    function getRegisterProofInfo(
        uint256 identityId_
    ) external view returns (RegisterProofInfo memory);

    function isIdentityRegistered(uint256 identityId_) external view returns (bool);
}
