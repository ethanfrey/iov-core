import { Address } from "@iov/bcp";
export interface HeadTail {
    /** An array of start positions within the original data */
    readonly head: ReadonlyArray<number>;
    /** Arguments split by positions as defined by head */
    readonly tail: ReadonlyArray<Uint8Array>;
}
export declare class Abi {
    static calculateMethodId(signature: string): Uint8Array;
    static encodeAddress(address: Address): Uint8Array;
    static encodeUint256(value: string): Uint8Array;
    /**
     * Decode head-tail encoded data as described in
     * https://medium.com/@hayeah/how-to-decipher-a-smart-contract-method-call-8ee980311603
     */
    static decodeHeadTail(data: Uint8Array): HeadTail;
    static decodeVariableLength(data: Uint8Array): Uint8Array;
    private static padTo32;
}
