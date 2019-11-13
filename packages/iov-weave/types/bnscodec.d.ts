import {
  Address,
  ChainId,
  Identity,
  Nonce,
  PostableBytes,
  SignedTransaction,
  SigningJob,
  TransactionId,
  TxCodec,
  UnsignedTransaction,
} from "@iov/bcp";
import * as codecImpl from "./generated/codecimpl";
export interface TxType {
  readonly encode: (message: codecImpl.bnsd.ITx) => protobuf.Writer;
  readonly decode: (data: Uint8Array) => codecImpl.bnsd.Tx;
}
export declare class WeaveCodec<T extends TxType> implements TxCodec {
  private readonly txType;
  constructor(txType: T);
  bytesToSign(tx: UnsignedTransaction, nonce: Nonce): SigningJob;
  bytesToPost(tx: SignedTransaction): PostableBytes;
  identifier(tx: SignedTransaction): TransactionId;
  parseBytes(bz: PostableBytes, chainId: ChainId): SignedTransaction;
  identityToAddress(identity: Identity): Address;
  isValidAddress(address: string): boolean;
}
export declare const bnsCodec: WeaveCodec<typeof codecImpl.bnsd.Tx>;
