// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {StringSet} from "@solarity/solidity-lib/libs/data-structures/StringSet.sol";
import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";

import {ICircuitValidator} from "@iden3/contracts/interfaces/ICircuitValidator.sol";
import {PoseidonFacade} from "@iden3/contracts/lib/Poseidon.sol";

import {ILightweightState} from "../interfaces/iden3/ILightweightState.sol";
import {IZKPQueriesStorage} from "../interfaces/iden3/IZKPQueriesStorage.sol";

/**
 * @dev This contract is a copy of the ZKPQueriesStorage contract from Rarimo [identity-contracts repository](https://github.com/rarimo/identity-contracts/tree/aeb929ccc3fa8ab508fd7576f9fa853a081e5010).
 */
contract ZKPQueriesStorage is IZKPQueriesStorage, OwnableUpgradeable, UUPSUpgradeable {
    using StringSet for StringSet.Set;
    using TypeCaster for uint256;

    ILightweightState public override lightweightState;

    mapping(string => QueryInfo) internal _queriesInfo;

    StringSet.Set internal _supportedQueryIds;

    constructor() {
        _disableInitializers();
    }

    function __ZKPQueriesStorage_init(address lightweightStateAddr_) external initializer {
        __Ownable_init();

        require(
            lightweightStateAddr_ != address(0),
            "ZKPQueriesStorage: Zero lightweightState address."
        );

        lightweightState = ILightweightState(lightweightStateAddr_);
    }

    function setZKPQuery(
        string memory queryId_,
        QueryInfo memory queryInfo_
    ) external override onlyOwner {
        require(
            address(queryInfo_.queryValidator) != address(0),
            "ZKPQueriesStorage: Zero queryValidator address."
        );

        _queriesInfo[queryId_] = queryInfo_;

        _supportedQueryIds.add(queryId_);

        emit ZKPQuerySet(queryId_, address(queryInfo_.queryValidator), queryInfo_.circuitQuery);
    }

    function removeZKPQuery(string memory queryId_) external override onlyOwner {
        require(isQueryExists(queryId_), "ZKPQueriesStorage: ZKP Query does not exist.");

        _supportedQueryIds.remove(queryId_);

        delete _queriesInfo[queryId_];

        emit ZKPQueryRemoved(queryId_);
    }

    function getSupportedQueryIDs() external view override returns (string[] memory) {
        return _supportedQueryIds.values();
    }

    function getQueryInfo(
        string memory queryId_
    ) external view override returns (QueryInfo memory) {
        return _queriesInfo[queryId_];
    }

    function getQueryValidator(string memory queryId_) external view override returns (address) {
        return _queriesInfo[queryId_].queryValidator;
    }

    function getStoredCircuitQuery(
        string memory queryId_
    ) external view override returns (CircuitQuery memory) {
        return _queriesInfo[queryId_].circuitQuery;
    }

    function getStoredQueryHash(string memory queryId_) external view override returns (uint256) {
        return getQueryHash(_queriesInfo[queryId_].circuitQuery);
    }

    function getStoredSchema(string memory queryId_) external view override returns (uint256) {
        return _queriesInfo[queryId_].circuitQuery.schema;
    }

    function isQueryExists(string memory queryId_) public view override returns (bool) {
        return _supportedQueryIds.contains(queryId_);
    }

    function getQueryHash(
        CircuitQuery memory circuitQuery_
    ) public pure override returns (uint256) {
        return
            getQueryHashRaw(
                circuitQuery_.schema,
                circuitQuery_.slotIndex,
                circuitQuery_.operator,
                circuitQuery_.claimPathKey,
                circuitQuery_.claimPathNotExists,
                circuitQuery_.values
            );
    }

    function getQueryHashRaw(
        uint256 schema_,
        uint256 slotIndex_,
        uint256 operator_,
        uint256 claimPathKey_,
        uint256 claimPathNotExists_,
        uint256[] memory values_
    ) public pure override returns (uint256) {
        uint256 valueHash_ = PoseidonFacade.poseidonSponge(values_);

        return
            PoseidonFacade.poseidon6(
                [schema_, slotIndex_, operator_, claimPathKey_, claimPathNotExists_, valueHash_]
            );
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
