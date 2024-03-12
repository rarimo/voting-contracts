// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {PoseidonSMT} from "../utils/PoseidonSMT.sol";

import {IRegistration} from "../interfaces/core/IRegistration.sol";

/**
 * @title Registration Mock Contract
 */
contract RegistrationMock is PoseidonSMT {
    bool public isRegistrationPending;

    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public rootsHistory;

    constructor(uint256 treeHeight_) {
        __PoseidonSMT_init(treeHeight_);
    }

    function registerMock(bytes32 commitment_) external {
        _add(commitment_);
        commitments[commitment_] = true;
        rootsHistory[getRoot()] = true;
    }

    function setRegistrationStatus(bool status) external {
        isRegistrationPending = status;
    }

    function isRootExists(bytes32 root) external view returns (bool) {
        return rootsHistory[root];
    }

    function getRegistrationInfo() external view returns (IRegistration.RegistrationInfo memory) {
        if (!isRegistrationPending) {
            return
                IRegistration.RegistrationInfo({
                    remark: "remark",
                    values: IRegistration.RegistrationValues({
                        commitmentStartTime: 0,
                        commitmentEndTime: 0
                    }),
                    counters: IRegistration.RegistrationCounters({totalRegistrations: 0})
                });
        }

        return
            IRegistration.RegistrationInfo({
                remark: "remark",
                values: IRegistration.RegistrationValues({
                    commitmentStartTime: block.timestamp * 10,
                    commitmentEndTime: block.timestamp * 10
                }),
                counters: IRegistration.RegistrationCounters({totalRegistrations: 0})
            });
    }

    function getRegistrationStatus() public pure returns (IRegistration.RegistrationStatus) {
        return IRegistration.RegistrationStatus.ENDED;
    }
}
