import * as fs from "fs";
import { ZERO_ADDR } from "@/scripts/utils/constants";

export type Config = {
  owners: OwnerModel;
  validatorContractInfo: ValidatorContractInfo;
  stateContractInfo: StateContractInfo;
  registerVerifierInfo: RegisterVerifierInfo;
  poseidonFacade?: string;
  zkpQueriesStorage?: string;
  zkpQueries: ZKPQueryInfo[];
};

export type OwnerModel = {
  zkpQueriesStorage: string;
  votingRegistry: string;
  baseVerifier: string;
  queryValidator: string;
};

export type ValidatorContractInfo = {
  validatorAddr?: string;
  zkpVerifierAddr?: string;
  identitiesStatesUpdateTime?: string | number;
};

export type StateContractInfo = {
  stateAddr?: string;
  stateInitParams?: StateInitParams;
};

export type StateInitParams = {
  signer: string;
  sourceStateContract: string;
  sourceChainName: string;
  chainName: string;
};

export type RegisterVerifierInfo = {
  registerVerifierAddr?: string;
  issuingAuthorityWhitelist?: string[];
  issuingAuthorityBlacklist?: string[];
};

export type ZKPQueryInfo = {
  queryId: string;
  validatorAddr?: string;
  circuitId: string;
  query: ZKPQuery;
  allowedIssuers: string[];
};

export type ZKPQuery = {
  schema: bigint;
  slotIndex: bigint;
  operator: bigint;
  claimPathKey: bigint;
  claimPathNotExists: bigint;
  values: bigint[];
};

export function parseConfig(configPath: string): Config {
  const config: Config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Config;

  if (config.stateContractInfo.stateAddr == undefined && config.stateContractInfo.stateInitParams == undefined) {
    throw new Error(`Invalid state contract address or state init params.`);
  }

  if (config.stateContractInfo.stateInitParams != undefined) {
    validateStateInitParams(config.stateContractInfo.stateInitParams);
  }

  if (
    config.validatorContractInfo.validatorAddr == undefined &&
    config.validatorContractInfo.identitiesStatesUpdateTime == undefined
  ) {
    throw new Error(`Invalid validator contract address or validator init params.`);
  }

  parseQueriesArr(config.zkpQueries);

  validateOwnerModel(config.owners);

  return config;
}

export function nonZeroAddr(filedDataRaw: string | undefined, filedName: string) {
  if (isZeroAddr(filedDataRaw)) {
    throw new Error(`Invalid ${filedName} filed.`);
  }
}

export function nonEmptyFiled(filedDataRaw: string | undefined, filedName: string) {
  if (isEmptyField(filedDataRaw)) {
    throw new Error(`Empty ${filedName} filed.`);
  }
}

export function isZeroAddr(filedDataRaw: string | undefined) {
  return isEmptyField(filedDataRaw) || filedDataRaw === ZERO_ADDR;
}

export function isEmptyField(filedDataRaw: string | undefined) {
  return !filedDataRaw || filedDataRaw == "";
}

function validateOwnerModel(ownerModel: OwnerModel) {
  nonZeroAddr(ownerModel.zkpQueriesStorage, "owners.zkpQueriesStorage");
  nonZeroAddr(ownerModel.votingRegistry, "owners.votingRegistry");
  nonZeroAddr(ownerModel.baseVerifier, "owners.baseVerifier");
  nonZeroAddr(ownerModel.queryValidator, "owners.queryValidator");
}

function validateStateInitParams(stateInitParams: StateInitParams) {
  nonZeroAddr(stateInitParams.signer, "signer");
  nonZeroAddr(stateInitParams.sourceStateContract, "sourceStateContract");
  nonEmptyFiled(stateInitParams.sourceChainName, "sourceChainName");
  nonEmptyFiled(stateInitParams.chainName, "chainName");
}

function parseQueriesArr(zkpQueries: ZKPQueryInfo[]) {
  zkpQueries.forEach((zkpQueryInfo: ZKPQueryInfo) => {
    zkpQueryInfo.queryId = zkpQueryInfo.queryId.toString();
    zkpQueryInfo.circuitId = zkpQueryInfo.circuitId.toString();
    zkpQueryInfo.query.schema = BigInt(zkpQueryInfo.query.schema.toString());
    zkpQueryInfo.query.slotIndex = BigInt(zkpQueryInfo.query.slotIndex.toString());
    zkpQueryInfo.query.operator = BigInt(zkpQueryInfo.query.operator.toString());
    zkpQueryInfo.query.claimPathKey = BigInt(zkpQueryInfo.query.claimPathKey.toString());
    zkpQueryInfo.query.claimPathNotExists = BigInt(zkpQueryInfo.query.claimPathNotExists.toString());

    if (zkpQueryInfo.allowedIssuers.length == 0) {
      throw new Error(`Invalid allowedIssuers number for ${zkpQueryInfo.queryId} query.`);
    }

    zkpQueryInfo.query.values = [
      ...zkpQueryInfo.query.values,
      ...new Array(64 - zkpQueryInfo.query.values.length).fill(0n).map((_i) => 0n),
    ];
  });
}
