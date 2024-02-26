// ElemBytes length is 32 bytes. But not all 32-byte values are valid.
// The value should be not greater than Q constant
export const MAX_BIG_INT = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const UserPK = "28156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69e";

export const IssuerPK = "28156abe7fe2fd433dc9df969286b96666489bac508612d0e16593e944c4f69d";

export const timestamp = 1642074362n;

export const requestID = 32n;

export const IssuerLevels = 40;
export const ClaimLevels = 32;
export const ValueArraySize = 1;
export const IDOwnershipLevels = 40;
export const OnChainLevels = 64;

// AuthSchemaHash predefined value of auth schema, used for auth claim during identity creation.
// This schema is hardcoded in the identity circuits and used to verify user's auth claim.
// Keccak256(https://schema.iden3.io/core/jsonld/auth.jsonld#AuthBJJCredential) last 16 bytes
// Hex: cca3371a6cb1b715004407e325bd993c
// BigInt: 80551937543569765027552589160822318028
export const AuthSchemaHash = 80551937543569765027552589160822318028n;

// List of available operators.
export enum Operator {
  NOOP,
  EQ,
  LT,
  GT,
  IN,
  NIN,
  NE,
}

export const TestClaimDocument = `{
   "@context": [
     "https://www.w3.org/2018/credentials/v1",
     "https://w3id.org/citizenship/v1",
     "https://w3id.org/security/bbs/v1"
   ],
   "id": "https://issuer.oidp.uscis.gov/credentials/83627465",
   "type": ["VerifiableCredential", "PermanentResidentCard"],
   "issuer": "did:example:489398593",
   "identifier": 83627465,
   "name": "Permanent Resident Card",
   "description": "Government of Example Permanent Resident Card.",
   "issuanceDate": "2019-12-03T12:19:52Z",
   "expirationDate": "2029-12-03T12:19:52Z",
   "credentialSubject": {
     "id": "did:example:b34ca6cd37bbf23",
     "type": ["PermanentResident", "Person"],
     "givenName": "JOHN",
     "familyName": "SMITH",
     "gender": "Male",
     "image": "data:image/png;base64,iVBORw0KGgokJggg==",
     "residentSince": "2015-01-01",
     "lprCategory": "C09",
     "lprNumber": "999-999-999",
     "commuterClassification": "C1",
     "birthCountry": "Bahamas",
     "birthDate": "1958-07-17"
   }
 }`;

export const RegistrationDocument = {
  id: "https://issuer.polygon.robotornot.mainnet-beta.rarimo.com/v1/credentials/4940ae5d-d198-11ee-b1f8-220bd8de42d4",
  "@context": [
    "https://ipfs.rarimo.com/ipfs/QmYCGiCoDn9WVoSwUBA8XLhgjzbeYLWZPfoM3scdtkWpfF",
    "https://schema.iden3.io/core/jsonld/iden3proofs.jsonld",
    "https://ipfs.rarimo.com/ipfs/QmUkU8MwPBtkEyDgx7VdavLiqLNpxQTBa1HM5LFjjAo6Fp",
  ],
  type: ["VerifiableCredential", "VotingCredential"],
  expirationDate: "2025-02-22T00:00:00Z",
  issuanceDate: "2024-02-22T15:37:28.927787569Z",
  credentialSubject: {
    credentialHash: 0n,
    documentNullifier: "",
    id: "",
    isAdult: false,
    issuingAuthority: 0n,
    type: "VotingCredential",
  },
  credentialStatus: {
    id: "https://issuer.polygon.robotornot.mainnet-beta.rarimo.com/v1/credentials/revocation/status/2796425752",
    revocationNonce: 2796425752,
    type: "SparseMerkleTreeProof",
  },
  issuer: "",
  credentialSchema: {
    id: "https://ipfs.rarimo.com/ipfs/QmZC7astRLY2UHZqopLBXyvztwjwVskbdQBbk46q1fJ5C2",
    type: "JsonSchema2023",
  },
};
