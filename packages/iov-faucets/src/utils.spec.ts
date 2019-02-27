import { Address, Algorithm, ChainId, PublicIdentity, PublicKeyBytes } from "@iov/bcp";
import { bnsCodec } from "@iov/bns";
import { Ed25519, Random } from "@iov/crypto";

/**
 * Helper function for tests. Not exported in the package.
 */
export async function randomBnsAddress(): Promise<Address> {
  const rawKeypair = await Ed25519.makeKeypair(await Random.getBytes(32));
  const randomIdentity: PublicIdentity = {
    chainId: "some-testnet" as ChainId,
    pubkey: {
      algo: Algorithm.Ed25519,
      data: rawKeypair.pubkey as PublicKeyBytes,
    },
  };
  return bnsCodec.identityToAddress(randomIdentity);
}
