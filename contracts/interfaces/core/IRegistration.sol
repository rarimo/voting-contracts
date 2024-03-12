// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IBaseVerifier} from "../iden3/verifiers/IBaseVerifier.sol";
import {IRegisterVerifier} from "../iden3/verifiers/IRegisterVerifier.sol";

/**
 * @title IRegistration Interface
 * @dev Interface for the registration process, detailing the setup, registration for voting, and querying registration status.
 */
interface IRegistration {
    /**
     * @notice Enumeration for registration status
     */
    enum RegistrationStatus {
        NONE, // No registration created
        NOT_STARTED, // Registration created but not started
        COMMITMENT, // Commitment phase for registration
        ENDED // Registration has concluded
    }

    /**
     * @notice Struct for registration parameters configuration
     * @param remark Description or title of the registration phase
     * @param commitmentStart Timestamp for the start of the registration phase
     * @param commitmentPeriod Duration in seconds of the registration phase
     */
    struct RegistrationParams {
        string remark;
        uint256 commitmentStart;
        uint256 commitmentPeriod;
    }

    /**
     * @notice Struct for tracking registration phase timings
     * @param commitmentStartTime Start timestamp of the registration phase
     * @param commitmentEndTime End timestamp of the registration phase
     */
    struct RegistrationValues {
        uint256 commitmentStartTime;
        uint256 commitmentEndTime;
    }

    /**
     * @notice Struct for counting registrations
     * @param totalRegistrations Total number of registered users
     */
    struct RegistrationCounters {
        uint256 totalRegistrations;
    }

    /**
     * @notice Struct for detailed information about a registration phase
     * @param remark Title or description of the registration
     * @param values Timing information for the registration phases
     * @param counters Count of registered users
     */
    struct RegistrationInfo {
        string remark;
        RegistrationValues values;
        RegistrationCounters counters;
    }

    /**
     * @notice Emitted when a new registration is initialized
     * @param proposer Address of the proposer initializing the registration. Usually the factory contract
     * @param registrationParams Struct containing the parameters of the registration phase
     */
    event RegistrationInitialized(address indexed proposer, RegistrationParams registrationParams);

    /**
     * @notice Emitted when a user successfully registers
     * @param user Address of the user registering
     * @param proveIdentityParams Parameters used for proving the user's identity
     * @param registerProofParams Parameters used for the registration proof
     */
    event UserRegistered(
        address indexed user,
        IBaseVerifier.ProveIdentityParams proveIdentityParams,
        IRegisterVerifier.RegisterProofParams registerProofParams
    );

    /**
     * @notice Initializes a new registration session with specified parameters
     * @param registrationParams_ The parameters for the registration session, including start times, and periods.
     */
    function __Registration_init(RegistrationParams calldata registrationParams_) external;

    /**
     * @notice Registers a user, verifying their identity and registration proof
     * @dev Requires the voting to be in the registration phase. Emits a UserRegistered event upon success.
     * @param proveIdentityParams_ Parameters to prove the user's identity.
     * @param registerProofParams_ Parameters for the user's registration proof.
     * @param transitStateParams_ Parameters for state transition, if applicable.
     * @param isTransitState_ Flag indicating whether a state transition is required.
     */
    function register(
        IBaseVerifier.ProveIdentityParams memory proveIdentityParams_,
        IRegisterVerifier.RegisterProofParams memory registerProofParams_,
        IBaseVerifier.TransitStateParams memory transitStateParams_,
        bool isTransitState_
    ) external;

    /**
     * @notice Checks if the Merkle tree root exists
     * @param root The root of the Merkle tree
     * @return True if the root exists, false otherwise
     */
    function isRootExists(bytes32 root) external view returns (bool);

    /**
     * @notice Retrieves the registration information
     * @return RegistrationInfo Struct containing detailed information about the registration phase
     */
    function getRegistrationInfo() external view returns (RegistrationInfo memory);

    /**
     * @notice Retrieves the current status of the registration phase
     */
    function getRegistrationStatus() external view returns (RegistrationStatus);

    /**
     * @notice Checks if a user is already registered
     * @param documentNullifier_ The nullifier of the user's document
     * @return True if the user is already registered, false otherwise
     */
    function isUserRegistered(uint256 documentNullifier_) external view returns (bool);
}
