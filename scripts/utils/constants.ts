export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
export const ETHER_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const SECONDS_IN_DAY = 86400;
export const SECONDS_IN_MONTH = SECONDS_IN_DAY * 30;

export const DECIMAL = 10n ** 18n;
export const PRECISION = 10n ** 25n;
export const PERCENTAGE_100 = PRECISION * 100n;

export enum RegistrationStatus {
  NONE,
  NOT_STARTED,
  COMMITMENT,
  ENDED,
}

export enum VotingStatus {
  NONE,
  NOT_STARTED,
  PENDING,
  ENDED,
}

export const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
