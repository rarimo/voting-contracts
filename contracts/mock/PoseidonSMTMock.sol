// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {PoseidonSMT} from "../utils/PoseidonSMT.sol";

contract PoseidonSMTMock is PoseidonSMT {
    function __PoseidonSMTMock_init(uint256 treeHeight_) external {
        __PoseidonSMT_init(treeHeight_);
    }

    function add(bytes32 element_) external {
        _add(element_);
    }
}
