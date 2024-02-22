// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {PoseidonSMT} from "../utils/PoseidonSMT.sol";

import {IRegistration} from "../interfaces/IRegistration.sol";

/**
 * @title Registration Mock Contract
 */
contract RegistrationMock is PoseidonSMT {
    bool public isRegistrationEnded;

    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public rootsHistory;

    constructor(uint256 treeHeight_) {
        __PoseidonSMT_init(treeHeight_);

        isRegistrationEnded = true;
    }

    function registerMock(bytes32 commitment_) external {
        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;
    }

    function setRegistrationStatus(bool status) external {
        isRegistrationEnded = status;
    }

    function isRootExists(bytes32 root) external view returns (bool) {
        return rootsHistory[root];
    }

    function getRegistrationStatus() public view returns (IRegistration.RegistrationStatus) {
        if (isRegistrationEnded) {
            return IRegistration.RegistrationStatus.ENDED;
        }

        return IRegistration.RegistrationStatus.NONE;
    }
}
