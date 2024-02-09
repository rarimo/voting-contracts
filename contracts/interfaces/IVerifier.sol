// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface IVerifier {
    function verifyProof(
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint[3] memory _pubSignals
    ) external view returns (bool);
}
