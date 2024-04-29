/// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;

import {PoseidonT2} from "./PoseidonT2.sol";
import {PoseidonT3} from "./PoseidonT3.sol";
import {PoseidonT4} from "./PoseidonT4.sol";
import {PoseidonT5} from "./PoseidonT5.sol";
import {PoseidonT6} from "./PoseidonT6.sol";
import {PoseidonT7} from "./PoseidonT7.sol";
import {SpongePoseidon} from "./SpongePoseidon.sol";

library PoseidonFacade {
    function poseidon1(uint256[1] calldata el) public pure returns (uint256) {
        return PoseidonT2.hash(el);
    }

    function poseidon2(uint256[2] calldata el) public pure returns (uint256) {
        return PoseidonT3.hash(el);
    }

    function poseidon3(uint256[3] calldata el) public pure returns (uint256) {
        return PoseidonT4.hash(el);
    }

    function poseidon4(uint256[4] calldata el) public pure returns (uint256) {
        return PoseidonT5.hash(el);
    }

    function poseidon5(uint256[5] calldata el) public pure returns (uint256) {
        return PoseidonT6.hash(el);
    }

    function poseidon6(uint256[6] calldata el) public pure returns (uint256) {
        return PoseidonT7.hash(el);
    }

    function poseidonSponge(uint256[] calldata el) public pure returns (uint256) {
        return SpongePoseidon.hash(el);
    }
}
