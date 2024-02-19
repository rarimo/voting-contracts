import "mock-local-storage";

import { LocalStorageDB, Merkletree, Proof, str2Bytes } from "@iden3/js-merkletree";

import { poseidon, PrivateKey, Signature } from "@iden3/js-crypto";
import { buildDIDType, Claim, DID, idenState, registerDidMethodNetwork } from "@iden3/js-iden3-core";

import { NodeAuxValue } from "@/test/helpers/iden3/types";
import { NewAuthClaim, PrepareProof } from "@/test/helpers/iden3/utils";

export class Identity {
  public id: DID;
  public claimTree: Merkletree;
  public revTree: Merkletree;
  public rootsTree: Merkletree;
  public authClaim: Claim;
  public pk: PrivateKey;

  public claimLevels: number;
  public revLevels: number;
  public rootsLevels: number;

  constructor(pk: string, claimLevels: number, revLevels: number, rootsLevels: number, prefix = "") {
    this.claimTree = new Merkletree(new LocalStorageDB(str2Bytes(prefix + "identity-claim-tree")), true, claimLevels);
    this.revTree = new Merkletree(new LocalStorageDB(str2Bytes(prefix + "identity-rev-tree")), true, revLevels);
    this.rootsTree = new Merkletree(new LocalStorageDB(str2Bytes(prefix + "identity-roots-tree")), true, rootsLevels);

    this.claimLevels = claimLevels;
    this.revLevels = revLevels;
    this.rootsLevels = rootsLevels;

    const [authClaim, key] = NewAuthClaim(pk);

    this.authClaim = authClaim;
    this.pk = key;

    registerDidMethodNetwork({
      method: "iden3",
      blockchain: "iden3",
      network: "iden3",
      networkFlag: 12,
    });

    // MUST-call postBuild after creating the object
    this.id = DID.newFromIdenState(buildDIDType("iden3", "iden3", "iden3"), 0n);
  }

  public async postBuild(): Promise<Identity> {
    const hiHv = this.authClaim.hiHv();
    await this.claimTree.add(hiHv.hi, hiHv.hv);

    const state = await this.state();

    this.id = DID.newFromIdenState(buildDIDType("iden3", "iden3", "iden3"), state);

    return this;
  }

  public async state(): Promise<bigint> {
    const cltRoot = (await this.claimTree.root()).bigInt();
    const retRoot = (await this.revTree.root()).bigInt();
    const rotRoot = (await this.rootsTree.root()).bigInt();

    return idenState(cltRoot, retRoot, rotRoot);
  }

  public async sign(challenge: bigint): Promise<Signature> {
    return this.pk.signPoseidon(challenge);
  }

  public async claimMTPRaw(claim: Claim): Promise<[Proof, bigint]> {
    const hiHv = claim.hiHv();

    const proof = await this.claimTree.generateProof(hiHv.hi);

    return [proof.proof, proof.value];
  }

  public async authMTPProofSiblings(): Promise<bigint[]> {
    const [proof, _] = await this.claimMTPRaw(this.authClaim);

    const prepared = PrepareProof(proof, this.claimLevels);

    return prepared[0];
  }

  public async signClaim(claim: Claim): Promise<Signature> {
    const hiHv = claim.hiHv();

    const commonHash = poseidon.hash([hiHv.hi, hiHv.hv]);

    return this.sign(commonHash);
  }

  public async claimMTP(claim: Claim): Promise<[bigint[], NodeAuxValue]> {
    const [proof, _] = await this.claimMTPRaw(claim);

    return PrepareProof(proof, this.claimLevels);
  }

  public async claimRevMTPRaw(claim: Claim): Promise<[Proof, bigint]> {
    const revNonce = claim.getRevocationNonce();

    const proof = await this.revTree.generateProof(revNonce);

    return [proof.proof, proof.value];
  }

  public async claimRevMTP(claim: Claim): Promise<[bigint[], NodeAuxValue]> {
    const [proof, _] = await this.claimRevMTPRaw(claim);

    return PrepareProof(proof, this.revLevels);
  }

  public async idHash(): Promise<bigint> {
    return poseidon.hash([DID.idFromDID(this.id).bigInt()]);
  }

  public async addClaim(claim: Claim): Promise<void> {
    const hiHv = claim.hiHv();

    await this.claimTree.add(hiHv.hi, hiHv.hv);
  }
}
