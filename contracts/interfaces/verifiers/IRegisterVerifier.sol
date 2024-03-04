// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IBaseVerifier} from "./IBaseVerifier.sol";
import {ILightweightState} from "../ILightweightState.sol";

/**
 * @title IRegisterVerifier
 * @notice Interface for the RegisterVerifier contract.
 */
interface IRegisterVerifier is IBaseVerifier {
    /**
     * @notice Struct to hold parameters for registration proof.
     * @param issuingAuthority The identifier for the issuing authority.
     * @param documentNullifier The unique nullifier for the document to prevent double registration.
     * @param commitment A commitment hash representing the registered identity.
     */
    struct RegisterProofParams {
        uint256 issuingAuthority;
        uint256 documentNullifier;
        bytes32 commitment;
    }

    /**
     * @notice Struct to encapsulate registration proof parameters along with the voting address.
     * @param registerProofParams The registration proof parameters.
     * @param registrationContractAddress The address of the registration contract.
     */
    struct RegisterProofInfo {
        RegisterProofParams registerProofParams;
        address registrationContractAddress;
    }

    /**
     * @notice Emitted when a registration is accepted.
     * @param documentNullifier The unique nullifier for the document.
     * @param registerProofInfo The information regarding the registration proof.
     */
    event RegisterAccepted(uint256 documentNullifier, RegisterProofInfo registerProofInfo);

    /**
     * @notice Proves registration with given parameters.
     * @param proveIdentityParams_ Parameters required for proving identity.
     * @param registerProofInfo_ The registration proof information.
     */
    function proveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_
    ) external;

    /**
     * @notice Transitions state and proves registration with given parameters.
     * @param proveIdentityParams_ Parameters required for proving identity.
     * @param registerProofInfo_ The registration proof information.
     * @param transitStateParams_ Parameters required for state transition.
     */
    function transitStateAndProveRegistration(
        ProveIdentityParams memory proveIdentityParams_,
        RegisterProofInfo memory registerProofInfo_,
        TransitStateParams memory transitStateParams_
    ) external;

    /**
     * @notice Retrieves registration proof information for a given document nullifier.
     * @param registrationContract_ The address of the registration contract.
     * @param documentNullifier_ The unique nullifier for the document.
     * @return RegisterProofInfo The registration proof information.
     */
    function getRegisterProofInfo(
        address registrationContract_,
        uint256 documentNullifier_
    ) external view returns (RegisterProofInfo memory);

    /**
     * @notice Checks if an identity is registered.
     * @param registrationContract_ The address of the registration contract.
     * @param documentNullifier_ The unique nullifier for the document.
     * @return bool True if the identity is registered, false otherwise.
     */
    function isIdentityRegistered(
        address registrationContract_,
        uint256 documentNullifier_
    ) external view returns (bool);

    /**
     * @notice Checks if an issuing authority is whitelisted.
     * @param issuingAuthority_ The identifier for the issuing authority.
     * @return bool True if the issuing authority is whitelisted, false otherwise.
     */
    function isIssuingAuthorityWhitelisted(uint256 issuingAuthority_) external view returns (bool);

    /**
     * @notice Checks if an issuing authority is blacklisted.
     * @param issuingAuthority_ The identifier for the issuing authority.
     * @return bool True if the issuing authority is blacklisted, false otherwise.
     */
    function isIssuingAuthorityBlacklisted(uint256 issuingAuthority_) external view returns (bool);

    /**
     * @notice Returns the number of issuing authorities in the whitelist.
     */
    function countIssuingAuthorityWhitelist() external view returns (uint256);

    /**
     * @notice Returns the number of issuing authorities in the blacklist.
     */
    function countIssuingAuthorityBlacklist() external view returns (uint256);

    /**
     * @notice Returns a list of issuing authorities in the whitelist.
     * @param offset_ The offset from which to start fetching the list.
     * @param limit_ The maximum number of items to fetch.
     * @return uint256[] The list of issuing authorities in the whitelist.
     */
    function listIssuingAuthorityWhitelist(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256[] memory);

    /**
     * @notice Returns a list of issuing authorities in the blacklist.
     * @param offset_ The offset from which to start fetching the list.
     * @param limit_ The maximum number of items to fetch.
     * @return uint256[] The list of issuing authorities in the blacklist.
     */
    function listIssuingAuthorityBlacklist(
        uint256 offset_,
        uint256 limit_
    ) external view returns (uint256[] memory);
}
