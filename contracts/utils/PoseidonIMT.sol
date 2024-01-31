// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IncrementalMerkleTree} from "@solarity/solidity-lib/libs/data-structures/IncrementalMerkleTree.sol";

import {PoseidonUnit1L, PoseidonUnit2L} from "../libs/Poseidon.sol";

contract PoseidonIMT {
    using IncrementalMerkleTree for IncrementalMerkleTree.Bytes32IMT;

    IncrementalMerkleTree.Bytes32IMT internal bytes32Tree;

    constructor(uint256 treeHeight_) {
        bytes32Tree.setHeight(treeHeight_);
        bytes32Tree.setHashers(_hash1, _hash2);
    }

    function getRoot() public view returns (bytes32) {
        return bytes32Tree.root();
    }

    function _add(bytes32 element_) internal {
        bytes32Tree.add(element_);
    }

    function _hash1(bytes32 element1_) internal pure returns (bytes32) {
        return bytes32(PoseidonUnit1L.poseidon([uint256(element1_)]));
    }

    function _hash2(bytes32 element1_, bytes32 element2_) internal pure returns (bytes32) {
        return bytes32(PoseidonUnit2L.poseidon([uint256(element1_), uint256(element2_)]));
    }
}
