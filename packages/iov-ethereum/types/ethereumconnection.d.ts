import { Stream } from "xstream";
import { ChainId, PostableBytes } from "@iov/base-types";
import { BcpAccount, BcpAccountQuery, BcpAddressQuery, BcpConnection, BcpPubkeyQuery, BcpQueryEnvelope, BcpTicker, BcpTxQuery, BlockHeader, ConfirmedTransaction, Nonce, PostTxResponse, TokenTicker } from "@iov/bcp-types";
export declare class EthereumConnection implements BcpConnection {
    static establish(baseUrl: string, wsUrl: string | undefined): Promise<EthereumConnection>;
    private readonly baseUrl;
    private readonly myChainId;
    private readonly socket;
    constructor(baseUrl: string, chainId: ChainId, wsUrl: string | undefined);
    disconnect(): void;
    chainId(): ChainId;
    height(): Promise<number>;
    postTx(bytes: PostableBytes): Promise<PostTxResponse>;
    getTicker(_: TokenTicker): Promise<BcpQueryEnvelope<BcpTicker>>;
    getAllTickers(): Promise<BcpQueryEnvelope<BcpTicker>>;
    getAccount(query: BcpAccountQuery): Promise<BcpQueryEnvelope<BcpAccount>>;
    getNonce(query: BcpAddressQuery | BcpPubkeyQuery): Promise<Nonce>;
    getBlockHeader(height: number): Promise<BlockHeader>;
    watchBlockHeaders(): Stream<BlockHeader>;
    /** @deprecated use watchBlockHeaders().map(header => header.height) */
    changeBlock(): Stream<number>;
    watchAccount(_: BcpAccountQuery): Stream<BcpAccount | undefined>;
    watchNonce(_: BcpAddressQuery | BcpPubkeyQuery): Stream<Nonce>;
    searchTx(query: BcpTxQuery): Promise<ReadonlyArray<ConfirmedTransaction>>;
    listenTx(_: BcpTxQuery): Stream<ConfirmedTransaction>;
    liveTx(_: BcpTxQuery): Stream<ConfirmedTransaction>;
    private socketSend;
}
