declare const enum Address {}
export type AddressString = Address & string;

declare const enum Mnemonic {}
export type MnemonicString = Mnemonic & string;

declare const enum PrivateKey {}
export type PrivateKeyBuffer = PrivateKey & Uint8Array;
export type PrivateKeyString = PrivateKey & string;

declare const enum PublicKey {}
export type PublicKeyBuffer = PublicKey & Uint8Array;
export type PublicKeyString = PublicKey & string;

export interface KeyPairBuffer {
  readonly private: PrivateKeyBuffer;
  readonly public: PublicKeyBuffer;
}

export interface KeyPairString {
  readonly private: PrivateKeyString;
  readonly public: PublicKeyString;
}

declare const enum Seed {}
export type SeedBuffer = Seed & Uint8Array;
export type SeedString = Seed & string;
