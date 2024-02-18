import { Poseidon, PublicKey } from "@iden3/js-crypto";

import { Claim, SchemaHash, ClaimOptions, ElemBytes, DID } from "@iden3/js-iden3-core";
import { Merklizer } from "@iden3/js-jsonld-merklization";
import { TestClaimDocument } from "@/test/helpers";

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

export async function DefaultJSONUserClaim(subject: DID, schemaHash: SchemaHash): Promise<[Claim, Merklizer]> {
  const mz = await Merklizer.merklizeJSONLD(TestClaimDocument);

  const nonce = 10;

  return [
    Claim.newClaim(
      schemaHash,
      ClaimOptions.withIndexId(DID.idFromDID(subject)),
      ClaimOptions.withRevocationNonce(BigInt(nonce)),
      ClaimOptions.withIndexMerklizedRoot((await mz.root()).bigInt()),
    ),
    mz,
  ];
}
