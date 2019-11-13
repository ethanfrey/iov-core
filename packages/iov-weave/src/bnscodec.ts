import {
  Address,
  ChainId,
  Identity,
  Nonce,
  PostableBytes,
  PrehashType,
  SignedTransaction,
  SigningJob,
  TransactionId,
  TxCodec,
  UnsignedTransaction,
} from "@iov/bcp";
import { Encoding } from "@iov/encoding";
import { TxBytes, v0_31 } from "@iov/tendermint-rpc";

import { parseTx } from "./decode";
import { buildSignedTx, buildUnsignedTx } from "./encode";
import * as codecImpl from "./generated/codecimpl";
import { appendSignBytes, identityToAddress, isValidAddress } from "./util";

// TODO: make this more general
export interface TxType {
  readonly encode: (message: codecImpl.bnsd.ITx) => protobuf.Writer;
  readonly decode: (data: Uint8Array) => codecImpl.bnsd.Tx;
}

export class WeaveCodec<T extends TxType> implements TxCodec {
  private readonly txType: T;

  public constructor(txType: T) {
    this.txType = txType;
  }

  // these are the bytes we create to add a signature
  // they often include nonce and chainID, but not other signatures
  public bytesToSign(tx: UnsignedTransaction, nonce: Nonce): SigningJob {
    // we encode it without any signatures
    const built = buildUnsignedTx(tx);
    const bz = this.txType.encode(built).finish();
    // now we want to append the nonce and chainID
    const bytes = appendSignBytes(bz, tx.creator.chainId, nonce);
    return { bytes: bytes, prehashType: PrehashType.Sha512 };
  }

  // bytesToPost includes the raw transaction appended with the various signatures
  public bytesToPost(tx: SignedTransaction): PostableBytes {
    const built = buildSignedTx(tx);
    const out = new Uint8Array(this.txType.encode(built).finish());
    return out as PostableBytes;
  }

  // identifier is usually some sort of hash of bytesToPost, chain-dependent
  public identifier(tx: SignedTransaction): TransactionId {
    const transactionBytes = (this.bytesToPost(tx) as unknown) as TxBytes;
    const hash = v0_31.hashTx(transactionBytes);
    return Encoding.toHex(hash).toUpperCase() as TransactionId;
  }

  // parseBytes will recover bytes from the blockchain into a format we can use
  public parseBytes(bz: PostableBytes, chainId: ChainId): SignedTransaction {
    const parsed = this.txType.decode(bz);
    return parseTx(parsed, chainId);
  }

  public identityToAddress(identity: Identity): Address {
    return identityToAddress(identity);
  }

  public isValidAddress(address: string): boolean {
    return isValidAddress(address);
  }
}

export const bnsCodec = new WeaveCodec(codecImpl.bnsd.Tx);
