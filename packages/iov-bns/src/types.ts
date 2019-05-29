import * as Long from "long";
import { As } from "type-tagger";

import {
  Address,
  Algorithm,
  Amount,
  ChainId,
  FullSignature,
  isSendTransaction,
  isSwapAbortTransaction,
  isSwapClaimTransaction,
  isSwapOfferTransaction,
  LightTransaction,
  Nonce,
  PublicKeyBundle,
  PublicKeyBytes,
  SendTransaction,
  SignatureBytes,
  SwapAbortTransaction,
  SwapClaimTransaction,
  SwapOfferTransaction,
} from "@iov/bcp";

import { Int53 } from "@iov/encoding";

import * as codecImpl from "./generated/codecimpl";

// config (those are not used outside of @iov/bns)

export interface CashConfiguration {
  readonly minimalFee: Amount;
}

// username NFT

export interface ChainAddressPair {
  readonly chainId: ChainId;
  readonly address: Address;
}

export interface BnsUsernameNft {
  readonly id: string;
  readonly owner: Address;
  readonly addresses: readonly ChainAddressPair[];
}

export interface BnsUsernamesByUsernameQuery {
  readonly username: string;
}

export interface BnsUsernamesByOwnerAddressQuery {
  readonly owner: Address;
}

export interface BnsUsernamesByChainAndAddressQuery {
  readonly chain: ChainId;
  readonly address: Address;
}

export type BnsUsernamesQuery =
  | BnsUsernamesByUsernameQuery
  | BnsUsernamesByOwnerAddressQuery
  | BnsUsernamesByChainAndAddressQuery;

export function isBnsUsernamesByUsernameQuery(
  query: BnsUsernamesQuery,
): query is BnsUsernamesByUsernameQuery {
  return typeof (query as BnsUsernamesByUsernameQuery).username !== "undefined";
}

export function isBnsUsernamesByOwnerAddressQuery(
  query: BnsUsernamesQuery,
): query is BnsUsernamesByOwnerAddressQuery {
  return typeof (query as BnsUsernamesByOwnerAddressQuery).owner !== "undefined";
}

export function isBnsUsernamesByChainAndAddressQuery(
  query: BnsUsernamesQuery,
): query is BnsUsernamesByChainAndAddressQuery {
  return (
    typeof (query as BnsUsernamesByChainAndAddressQuery).chain !== "undefined" &&
    typeof (query as BnsUsernamesByChainAndAddressQuery).address !== "undefined"
  );
}

// Rest

export type PrivateKeyBytes = Uint8Array & As<"private-key">;
export interface PrivateKeyBundle {
  readonly algo: Algorithm;
  readonly data: PrivateKeyBytes;
}

export interface Result {
  readonly key: Uint8Array;
  readonly value: Uint8Array;
}

export interface Keyed {
  readonly _id: Uint8Array;
}

export interface Decoder<T extends {}> {
  readonly decode: (data: Uint8Array) => T;
}

export function decodePubkey(publicKey: codecImpl.crypto.IPublicKey): PublicKeyBundle {
  if (publicKey.ed25519) {
    return {
      algo: Algorithm.Ed25519,
      data: publicKey.ed25519 as PublicKeyBytes,
    };
  } else {
    throw new Error("Unknown public key algorithm");
  }
}

export function decodePrivkey(privateKey: codecImpl.crypto.IPrivateKey): PrivateKeyBundle {
  if (privateKey.ed25519) {
    return {
      algo: Algorithm.Ed25519,
      data: privateKey.ed25519 as PrivateKeyBytes,
    };
  } else {
    throw new Error("Unknown private key algorithm");
  }
}

export function decodeSignature(signature: codecImpl.crypto.ISignature): SignatureBytes {
  if (signature.ed25519) {
    return signature.ed25519 as SignatureBytes;
  } else {
    throw new Error("Unknown private key algorithm");
  }
}

/**
 * Decodes a protobuf int field (int32/uint32/int64/uint64) into a JavaScript
 * number.
 */
export function asIntegerNumber(maybeLong: Long | number | null | undefined): number {
  if (!maybeLong) {
    return 0;
  } else if (typeof maybeLong === "number") {
    if (!Number.isInteger(maybeLong)) {
      throw new Error("Number is not an integer.");
    }
    return maybeLong;
  } else {
    return maybeLong.toInt();
  }
}

export function asInt53(input: Long | number | null | undefined): Int53 {
  if (!input) {
    return new Int53(0);
  } else if (typeof input === "number") {
    return new Int53(input);
  } else {
    return Int53.fromString(input.toString());
  }
}

export function ensure<T>(maybe: T | null | undefined, msg?: string): T {
  if (maybe === null || maybe === undefined) {
    throw new Error("missing " + (msg || "field"));
  }
  return maybe;
}

export function decodeFullSig(sig: codecImpl.sigs.IStdSignature): FullSignature {
  return {
    nonce: asInt53(sig.sequence).toNumber() as Nonce,
    pubkey: decodePubkey(ensure(sig.pubkey)),
    signature: decodeSignature(ensure(sig.signature)),
  };
}

// transactions

export interface AddAddressToUsernameTx extends LightTransaction {
  readonly kind: "bns/add_address_to_username";
  /** the username to be updated, must exist on chain */
  readonly username: string;
  readonly payload: ChainAddressPair;
}

export interface Participant {
  readonly address: Address;
  readonly power: number;
}

export interface CreateMultisignatureTx extends LightTransaction {
  readonly kind: "bns/create_multisignature_contract";
  readonly participants: readonly Participant[];
  readonly activationThreshold: number;
  readonly adminThreshold: number;
}

export interface RegisterUsernameTx extends LightTransaction {
  readonly kind: "bns/register_username";
  readonly username: string;
  readonly addresses: readonly ChainAddressPair[];
}

export interface RemoveAddressFromUsernameTx extends LightTransaction {
  readonly kind: "bns/remove_address_from_username";
  /** the username to be updated, must exist on chain */
  readonly username: string;
  readonly payload: ChainAddressPair;
}

export interface UpdateMultisignatureTx extends LightTransaction {
  readonly kind: "bns/update_multisignature_contract";
  readonly contractId: Uint8Array;
  readonly participants: readonly Participant[];
  readonly activationThreshold: number;
  readonly adminThreshold: number;
}

export type BnsTx =
  // BCP
  | SendTransaction
  | SwapOfferTransaction
  | SwapClaimTransaction
  | SwapAbortTransaction
  // BNS
  | AddAddressToUsernameTx
  | CreateMultisignatureTx
  | RegisterUsernameTx
  | RemoveAddressFromUsernameTx
  | UpdateMultisignatureTx;

export function isBnsTx(transaction: LightTransaction): transaction is BnsTx {
  if (
    isSendTransaction(transaction) ||
    isSwapOfferTransaction(transaction) ||
    isSwapClaimTransaction(transaction) ||
    isSwapAbortTransaction(transaction)
  ) {
    return true;
  }

  return transaction.kind.startsWith("bns/");
}

export function isAddAddressToUsernameTx(
  transaction: LightTransaction,
): transaction is AddAddressToUsernameTx {
  return isBnsTx(transaction) && transaction.kind === "bns/add_address_to_username";
}

export function isCreateMultisignatureTx(
  transaction: LightTransaction,
): transaction is CreateMultisignatureTx {
  return isBnsTx(transaction) && transaction.kind === "bns/create_multisignature_contract";
}

export function isRegisterUsernameTx(transaction: LightTransaction): transaction is RegisterUsernameTx {
  return isBnsTx(transaction) && transaction.kind === "bns/register_username";
}

export function isRemoveAddressFromUsernameTx(
  transaction: LightTransaction,
): transaction is RemoveAddressFromUsernameTx {
  return isBnsTx(transaction) && transaction.kind === "bns/remove_address_from_username";
}

export function isUpdateMultisignatureTx(
  transaction: LightTransaction,
): transaction is UpdateMultisignatureTx {
  return isBnsTx(transaction) && transaction.kind === "bns/update_multisignature_contract";
}
