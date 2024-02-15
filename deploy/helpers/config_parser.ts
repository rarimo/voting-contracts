import * as fs from "fs";
import { ZERO_ADDR } from "@/scripts/utils/constants";

export type Config = {
  validatorContractInfo: ValidatorContractInfo;
  stateContractInfo: StateContractInfo;
  registerVerifierInfo: RegisterVerifierInfo;
  poseidonFacade?: string;
  zkpQueriesStorage?: string;
  zkpQueries: ZKPQueryInfo[];
};

export type ValidatorContractInfo = {
  validatorAddr?: string;
  zkpVerifierAddr?: string;
  identitiesStatesUpdateTime?: string | number;
};

export type StateContractInfo = {
  stateAddr?: string;
  stateInitParams?: StateInitParams;
  isLightweight: boolean | string;
};

export type StateInitParams = {
  signer: string;
  sourceStateContract: string;
  sourceChainName: string;
  chainName: string;
};

export type RegisterVerifierInfo = {
  registerVerifierAddr?: string;
};

export type ZKPQueryInfo = {
  queryId: string;
  validatorAddr?: string;
  query: ZKPQuery;
};

export type ZKPQuery = {
  schema: bigint;
  claimPathKey: bigint;
  operator: string | number;
  value: bigint[];
  queryHash: bigint;
  circuitId: string;
};

export function parseConfig(configPath: string = "deploy/data/config.json"): Config {
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

function validateStateInitParams(stateInitParams: StateInitParams) {
  nonZeroAddr(stateInitParams.signer, "signer");
  nonZeroAddr(stateInitParams.sourceStateContract, "sourceStateContract");
  nonEmptyFiled(stateInitParams.sourceChainName, "sourceChainName");
  nonEmptyFiled(stateInitParams.chainName, "chainName");
}

function parseQueriesArr(zkpQueries: ZKPQueryInfo[]) {
  zkpQueries.forEach((zkpQueryInfo: ZKPQueryInfo) => {
    zkpQueryInfo.query.schema = BigInt(zkpQueryInfo.query.schema.toString());
    zkpQueryInfo.query.claimPathKey = BigInt(zkpQueryInfo.query.claimPathKey.toString());
    zkpQueryInfo.query.value = [
      ...zkpQueryInfo.query.value,
      ...new Array(64 - zkpQueryInfo.query.value.length).fill(0n).map((_i) => 0n),
    ];
  });
}
