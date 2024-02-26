import { Poseidon, PublicKey } from "@iden3/js-crypto";

import { Merklizer } from "@iden3/js-jsonld-merklization";
import { Claim, SchemaHash, ClaimOptions, ElemBytes, DID } from "@iden3/js-iden3-core";

export function AuthClaimFromPubKey(publicKey: PublicKey): Claim {
  // NOTE: We take nonce as hash of public key to make it random
  // We don't use random number here because this test vectors will be used for tests
  // and have randomization inside tests is usually a bad idea
  const revNonce = Poseidon.hash([publicKey.p[0]]);

  return Claim.newClaim(
    SchemaHash.authSchemaHash,
    ClaimOptions.withIndexData(ElemBytes.fromInt(publicKey.p[0]), ElemBytes.fromInt(publicKey.p[1])),
    ClaimOptions.withRevocationNonce(revNonce),
  );
}

export function DefaultUserClaim(subject: DID, schemaHash: SchemaHash): Claim {
  const revNonce = BigInt(1);

  return Claim.newClaim(
    schemaHash,
    ClaimOptions.withIndexId(DID.idFromDID(subject)),
    ClaimOptions.withRevocationNonce(revNonce),
  );
}

export async function DefaultJSONUserClaim(
  subject: DID,
  schemaHash: SchemaHash,
  mz: Merklizer,
  claimSalt = 0n,
): Promise<Claim> {
  return Claim.newClaim(
    schemaHash,
    ClaimOptions.withIndexId(DID.idFromDID(subject)),
    ClaimOptions.withVersion(Number(claimSalt)),
    ClaimOptions.withRevocationNonce(10n),
    ClaimOptions.withIndexMerklizedRoot((await mz.root()).bigInt()),
  );
}

export async function RegistrationUserClaim(
  subject: DID,
  schemaHash: SchemaHash,
  mz: Merklizer,
  claimSalt = 0n,
): Promise<Claim> {
  return Claim.newClaim(
    schemaHash,
    ClaimOptions.withIndexId(DID.idFromDID(subject)),
    ClaimOptions.withVersion(Number(claimSalt)),
    ClaimOptions.withRevocationNonce(10n),
    ClaimOptions.withIndexMerklizedRoot((await mz.root()).bigInt()),
  );
}
