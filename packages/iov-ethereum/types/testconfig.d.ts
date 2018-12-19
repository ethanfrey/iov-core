import { Address, ChainId, Nonce, PublicKeyBytes } from "@iov/bcp-types";
export interface EthereumNetworkConfig {
    readonly env: string;
    readonly base: string;
    readonly webSocketUrl: string;
    readonly chainId: ChainId;
    readonly minHeight: number;
    readonly pubkey: PublicKeyBytes;
    readonly address: Address;
    readonly quantity: string;
    readonly nonce: Nonce;
    readonly gasPrice: string;
    readonly gasLimit: string;
    readonly waitForTx: number;
    readonly scraper?: {
        readonly api: string;
        readonly address: Address;
    };
}
export declare const TestConfig: EthereumNetworkConfig;
