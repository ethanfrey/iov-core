import {
  Address,
  Algorithm,
  Amount,
  BcpBlockInfoInBlock,
  BcpTransactionState,
  BlockHeader,
  ConfirmedTransaction,
  isSendTransaction,
  Nonce,
  PostTxResponse,
  PublicIdentity,
  PublicKeyBytes,
  SendTransaction,
  SignedTransaction,
  TokenTicker,
  TransactionId,
} from "@iov/bcp-types";
import { Random, Secp256k1 } from "@iov/crypto";
import { Int53 } from "@iov/encoding";
import { HdPaths, Secp256k1HdWallet, UserProfile, Wallet } from "@iov/keycontrol";
import { toListPromise } from "@iov/stream";

import { keyToAddress } from "./derivation";
import { ethereumCodec } from "./ethereumcodec";
import { EthereumConnection } from "./ethereumconnection";
import { scraperAddressTag } from "./tags";
import { testConfig } from "./testconfig.spec";

function skipTests(): boolean {
  return !process.env.ETHEREUM_ENABLED;
}

function pendingWithoutEthereum(): void {
  if (skipTests()) {
    return pending("Set ETHEREUM_ENABLED to enable ethereum-node-based tests");
  }
}

function skipTestsScraper(): boolean {
  return !process.env.ETHEREUM_SCRAPER;
}

function pendingWithoutEthereumScraper(): void {
  if (skipTestsScraper()) {
    return pending("Set ETHEREUM_SCRAPER to enable out-of-blockchain functionality tests");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomAddress(): Promise<Address> {
  const keypair = await Secp256k1.makeKeypair(await Random.getBytes(32));
  return keyToAddress({
    algo: Algorithm.Secp256k1,
    data: keypair.pubkey as PublicKeyBytes,
  });
}

async function postTransaction(
  wallet: Wallet,
  sender: PublicIdentity,
  nonce: Nonce,
  quantity: string,
  connection: EthereumConnection,
): Promise<PostTxResponse> {
  const recipientAddress = "0xE137f5264b6B528244E1643a2D570b37660B7F14" as Address;

  const sendTx: SendTransaction = {
    kind: "bcp/send",
    chainId: testConfig.chainId,
    signer: sender.pubkey,
    recipient: recipientAddress,
    amount: {
      quantity: quantity,
      fractionalDigits: 18,
      tokenTicker: "ETH" as TokenTicker,
    },
    gasPrice: testConfig.gasPrice,
    gasLimit: testConfig.gasLimit,
    memo: `Some text ${Math.random()}`,
  };
  const signingJob = ethereumCodec.bytesToSign(sendTx, nonce);
  const signature = await wallet.createTransactionSignature(sender, signingJob.bytes, signingJob.prehashType);

  const signedTransaction: SignedTransaction = {
    transaction: sendTx,
    primarySignature: {
      nonce: nonce,
      pubkey: sender.pubkey,
      signature: signature,
    },
    otherSignatures: [],
  };
  const bytesToPost = ethereumCodec.bytesToPost(signedTransaction);

  const resultPost = await connection.postTx(bytesToPost);
  return resultPost;
}

describe("EthereumConnection", () => {
  const defaultAmount: Amount = {
    quantity: "5445500",
    fractionalDigits: 18,
    tokenTicker: "ETH" as TokenTicker,
  };

  it("can be constructed", () => {
    pendingWithoutEthereum();
    const connection = new EthereumConnection(testConfig.base, testConfig.chainId);
    expect(connection).toBeTruthy();
    connection.disconnect();
  });

  it("can get chain ID", async () => {
    pendingWithoutEthereum();
    const connection = await EthereumConnection.establish(testConfig.base);
    const chainId = connection.chainId();
    expect(chainId).toEqual(testConfig.chainId);
    connection.disconnect();
  });

  it("can get height", async () => {
    pendingWithoutEthereum();
    const connection = await EthereumConnection.establish(testConfig.base);
    const height = await connection.height();
    expect(height).toBeGreaterThanOrEqual(testConfig.minHeight);
    connection.disconnect();
  });

  describe("getAccount", () => {
    it("can get account from address", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const account = await connection.getAccount({ address: testConfig.address as Address });
      expect(account.data[0].address).toEqual(testConfig.address);
      expect(account.data[0].balance[0]).toEqual({
        ...testConfig.expectedBalance,
        tokenName: "Ether",
      });
      connection.disconnect();
    });

    it("can get account from pubkey", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const account = await connection.getAccount({ pubkey: testConfig.pubkey });
      expect(account.data[0].address).toEqual(testConfig.address);
      expect(account.data[0].balance[0]).toEqual({
        ...testConfig.expectedBalance,
        tokenName: "Ether",
      });
      connection.disconnect();
    });

    it("can get account from unused address", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const account = await connection.getAccount({ address: testConfig.unusedAddress });

      // At the moment we cannot distinguish between unused account and balance 0
      expect(account.data.length).toEqual(1);
      expect(account.data[0].balance[0].quantity).toEqual("0");

      connection.disconnect();
    });

    it("can get account from unused pubkey", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const account = await connection.getAccount({ pubkey: testConfig.unusedPubkey });

      // At the moment we cannot distinguish between unused account and balance 0
      expect(account.data.length).toEqual(1);
      expect(account.data[0].balance[0].quantity).toEqual("0");

      connection.disconnect();
    });
  });

  it("can get nonce", async () => {
    pendingWithoutEthereum();
    const connection = await EthereumConnection.establish(testConfig.base);

    // by address
    {
      const nonce = await connection.getNonce({ address: testConfig.address as Address });
      expect(nonce).toEqual(testConfig.nonce);
    }

    // by pubkey
    {
      const nonce = await connection.getNonce({ pubkey: testConfig.pubkey });
      expect(nonce).toEqual(testConfig.nonce);
    }
    connection.disconnect();
  });

  describe("postTx", () => {
    it("can post transaction", async () => {
      pendingWithoutEthereum();

      const profile = new UserProfile();
      const wallet = profile.addWallet(
        Secp256k1HdWallet.fromMnemonic(
          "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
        ),
      );
      const secondIdentity = await profile.createIdentity(
        wallet.id,
        testConfig.chainId,
        HdPaths.bip44(60, 0, 0, 1),
      );

      const recipientAddress = "0xE137f5264b6B528244E1643a2D570b37660B7F14" as Address;

      const sendTx: SendTransaction = {
        kind: "bcp/send",
        chainId: testConfig.chainId,
        signer: secondIdentity.pubkey,
        recipient: recipientAddress,
        amount: {
          quantity: "3445500",
          fractionalDigits: 18,
          tokenTicker: "ETH" as TokenTicker,
        },
        gasPrice: testConfig.gasPrice,
        gasLimit: testConfig.gasLimit,
        memo: "We \u2665 developers – iov.one",
      };
      const connection = await EthereumConnection.establish(testConfig.base);
      const nonce = await connection.getNonce({ pubkey: secondIdentity.pubkey });
      const signed = await profile.signTransaction(wallet.id, secondIdentity, sendTx, ethereumCodec, nonce);
      const bytesToPost = ethereumCodec.bytesToPost(signed);

      const result = await connection.postTx(bytesToPost);
      expect(result).toBeTruthy();
      expect(result.log).toBeUndefined();

      // we need to wait here such that the following tests query an updated nonce
      await result.blockInfo.waitFor(info => info.state === BcpTransactionState.InBlock);

      connection.disconnect();
    }, 30_000);

    it("can post transaction and watch confirmations", async () => {
      pendingWithoutEthereum();

      const profile = new UserProfile();
      const wallet = profile.addWallet(
        Secp256k1HdWallet.fromMnemonic(
          "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
        ),
      );
      const secondIdentity = await profile.createIdentity(
        wallet.id,
        testConfig.chainId,
        HdPaths.bip44(60, 0, 0, 1),
      );

      const recipientAddress = "0xE137f5264b6B528244E1643a2D570b37660B7F14" as Address;

      const sendTx: SendTransaction = {
        kind: "bcp/send",
        chainId: testConfig.chainId,
        signer: secondIdentity.pubkey,
        recipient: recipientAddress,
        amount: {
          quantity: "3445500",
          fractionalDigits: 18,
          tokenTicker: "ETH" as TokenTicker,
        },
        gasPrice: testConfig.gasPrice,
        gasLimit: testConfig.gasLimit,
        memo: "We \u2665 developers – iov.one",
      };
      const connection = await EthereumConnection.establish(testConfig.base);
      const nonce = await connection.getNonce({ pubkey: secondIdentity.pubkey });
      const signed = await profile.signTransaction(wallet.id, secondIdentity, sendTx, ethereumCodec, nonce);
      const bytesToPost = ethereumCodec.bytesToPost(signed);

      const heightBeforeTransaction = await connection.height();
      const result = await connection.postTx(bytesToPost);
      expect(result).toBeTruthy();
      expect(result.blockInfo.value.state).toEqual(BcpTransactionState.Pending);

      const events = await toListPromise(result.blockInfo.updates, 2);

      expect(events[0]).toEqual({ state: BcpTransactionState.Pending });

      // In Ropsten and Rinkerby, the currentHeight can be less than transactionHeight.
      // Is there some caching for RPC calls happening? Ignore for now.
      expect(events[1]).toEqual({
        state: BcpTransactionState.InBlock,
        height: heightBeforeTransaction + 1,
        confirmations: 1,
      });
    }, 30_000);
  });

  describe("searchTx", () => {
    it("throws error for invalid transaction hash", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      // invalid lenght
      const invalidHashLenght = "0x1234567890abcdef" as TransactionId;
      await connection
        .searchTx({ id: invalidHashLenght })
        .then(() => fail("must not resolve"))
        .catch(error => expect(error).toMatch(/Invalid transaction ID format/i));
      connection.disconnect();
    });

    it("can search non-existing transaction by hash", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const nonExistingHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as TransactionId;
      const results = await connection.searchTx({ id: nonExistingHash });
      expect(results.length).toEqual(0);
      connection.disconnect();
    });

    it("can search previous posted transaction by hash", async () => {
      pendingWithoutEthereum();

      const profile = new UserProfile();
      const wallet = profile.addWallet(
        Secp256k1HdWallet.fromMnemonic(
          "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
        ),
      );
      const secondIdentity = await profile.createIdentity(
        wallet.id,
        testConfig.chainId,
        HdPaths.bip44(60, 0, 0, 1),
      );

      const recipientAddress = "0xE137f5264b6B528244E1643a2D570b37660B7F14" as Address;

      const sendTx: SendTransaction = {
        kind: "bcp/send",
        chainId: testConfig.chainId,
        signer: secondIdentity.pubkey,
        recipient: recipientAddress,
        amount: defaultAmount,
        gasPrice: testConfig.gasPrice,
        gasLimit: testConfig.gasLimit,
        memo: `Search tx test ${Math.random()}`,
      };
      const connection = await EthereumConnection.establish(testConfig.base);
      const nonce = await connection.getNonce({ pubkey: secondIdentity.pubkey });
      const signed = await profile.signTransaction(wallet.id, secondIdentity, sendTx, ethereumCodec, nonce);
      const bytesToPost = ethereumCodec.bytesToPost(signed);

      const resultPost = await connection.postTx(bytesToPost);
      expect(resultPost.transactionId).toMatch(/^0x[0-9a-f]{64}$/);
      await resultPost.blockInfo.waitFor(info => info.state === BcpTransactionState.InBlock);

      const resultSearch = await connection.searchTx({ id: resultPost.transactionId });
      expect(resultSearch.length).toEqual(1);
      const result = resultSearch[0];
      expect(result.transactionId).toEqual(resultPost.transactionId);
      expect(result.confirmations).toEqual(1);
      const transaction = result.transaction;
      if (!isSendTransaction(transaction)) {
        throw new Error("Unexpected transaction type");
      }
      expect(transaction.recipient).toEqual(recipientAddress);
      expect(transaction.amount.quantity).toEqual("5445500");
      connection.disconnect();
    }, 30_000);

    // TODO: load ganache with db from github
    xit("can search a transaction by hash", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const storedTxId = "" as TransactionId;
      const results = await connection.searchTx({ id: storedTxId });
      expect(results.length).toEqual(1);
      const result = results[0];
      expect(result.transactionId).toEqual(storedTxId);
      const transaction = result.transaction;
      if (!isSendTransaction(transaction)) {
        throw new Error("Unexpected transaction type");
      }
      expect(transaction.recipient).toEqual("recipient_address");
      expect(transaction.amount.quantity).toEqual("tx_quantity");
    });

    it("can search a transaction by account", async () => {
      pendingWithoutEthereum();
      pendingWithoutEthereumScraper();
      const connection = await EthereumConnection.establish(testConfig.base, {
        scraperApiUrl: testConfig.scraper!.apiUrl,
      });
      const results = await connection.searchTx({ tags: [scraperAddressTag(testConfig.scraper!.address)] });
      expect(results.length).toBeGreaterThan(1);
      connection.disconnect();
    });

    it("can search transactions by account and minHeight/maxHeight", async () => {
      pendingWithoutEthereum();
      pendingWithoutEthereumScraper();

      const connection = await EthereumConnection.establish(testConfig.base, {
        scraperApiUrl: testConfig.scraper!.apiUrl,
      });

      const profile = new UserProfile();
      const wallet = profile.addWallet(
        Secp256k1HdWallet.fromMnemonic(
          "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
        ),
      );
      const secondIdentity = await profile.createIdentity(
        wallet.id,
        testConfig.chainId,
        HdPaths.bip44(60, 0, 0, 1),
      );

      const recipientAddress = await randomAddress();

      const sendTx: SendTransaction = {
        kind: "bcp/send",
        chainId: testConfig.chainId,
        signer: secondIdentity.pubkey,
        recipient: recipientAddress,
        amount: {
          quantity: "5445500",
          fractionalDigits: 18,
          tokenTicker: "ETH" as TokenTicker,
        },
        gasPrice: testConfig.gasPrice,
        gasLimit: testConfig.gasLimit,
        memo: `Search tx test ${new Date()}`,
      };
      const nonce = await connection.getNonce({ pubkey: secondIdentity.pubkey });
      const signed = await profile.signTransaction(wallet.id, secondIdentity, sendTx, ethereumCodec, nonce);
      const bytesToPost = ethereumCodec.bytesToPost(signed);

      const resultPost = await connection.postTx(bytesToPost);
      const transactionId = resultPost.transactionId;
      const transactionHeight = ((await resultPost.blockInfo.waitFor(
        info => info.state === BcpTransactionState.InBlock,
      )) as BcpBlockInfoInBlock).height;

      // Random delay to give scraper a chance to receive and process the new block
      await sleep(25_000);

      // min height less than transaction height
      {
        const resultSearch = await connection.searchTx({
          minHeight: transactionHeight - 1,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(1);
        expect(resultSearch[0].transactionId).toEqual(transactionId);
      }

      // min height equals transaction height
      {
        const resultSearch = await connection.searchTx({
          minHeight: transactionHeight,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(1);
        expect(resultSearch[0].transactionId).toEqual(transactionId);
      }

      // min height greater than transaction height
      {
        const resultSearch = await connection.searchTx({
          minHeight: transactionHeight + 1,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(0);
      }

      // max height less than transaction height
      {
        const resultSearch = await connection.searchTx({
          maxHeight: transactionHeight - 1,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(0);
      }

      // max height equals transaction height
      {
        const resultSearch = await connection.searchTx({
          maxHeight: transactionHeight,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(1);
        expect(resultSearch[0].transactionId).toEqual(transactionId);
      }

      // max height greater than transaction height
      {
        const resultSearch = await connection.searchTx({
          maxHeight: transactionHeight + 1,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(1);
        expect(resultSearch[0].transactionId).toEqual(transactionId);
      }

      // min height less than max height
      {
        const resultSearch = await connection.searchTx({
          minHeight: transactionHeight - 1,
          maxHeight: transactionHeight + 1,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(1);
        expect(resultSearch[0].transactionId).toEqual(transactionId);
      }

      // min height equal to max height
      {
        const resultSearch = await connection.searchTx({
          minHeight: transactionHeight,
          maxHeight: transactionHeight,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(1);
        expect(resultSearch[0].transactionId).toEqual(transactionId);
      }

      // min height greater than max height
      {
        const resultSearch = await connection.searchTx({
          minHeight: transactionHeight,
          maxHeight: transactionHeight - 1,
          tags: [scraperAddressTag(recipientAddress)],
        });
        expect(resultSearch.length).toEqual(0);
      }

      connection.disconnect();
    }, 50_000);
  });

  describe("listenTx", () => {
    it("can can listen to transactions", done => {
      pendingWithoutEthereum();
      pendingWithoutEthereumScraper();

      (async () => {
        const connection = await EthereumConnection.establish(testConfig.base, {
          scraperApiUrl: testConfig.scraper!.apiUrl,
        });

        const recipientAddress = await randomAddress();

        // setup listener
        const events = new Array<ConfirmedTransaction>();
        const subscription = connection.listenTx({ tags: [scraperAddressTag(recipientAddress)] }).subscribe({
          next: event => {
            events.push(event);

            if (!isSendTransaction(event.transaction)) {
              throw new Error("Unexpected transaction type");
            }
            expect(event.transaction.recipient).toEqual(recipientAddress);

            if (events.length === 3) {
              // This assumes we get two transactions into one block
              // A == B < C
              expect(events[0].height).toEqual(events[1].height);
              expect(events[2].height).toBeGreaterThan(events[1].height);

              subscription.unsubscribe();
              connection.disconnect();
              done();
            }
          },
        });

        // send transactions

        const profile = new UserProfile();
        const wallet = profile.addWallet(
          Secp256k1HdWallet.fromMnemonic(
            "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
          ),
        );
        const sender = await profile.createIdentity(
          wallet.id,
          testConfig.chainId,
          HdPaths.bip44(60, 0, 0, 1),
        );

        const sendA: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `listenTx() test A ${Math.random()}`,
        };

        const sendB: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `listenTx() test B ${Math.random()}`,
        };

        const sendC: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `listenTx() test C ${Math.random()}`,
        };

        const nonceA = await connection.getNonce({ pubkey: sender.pubkey });
        const nonceB = new Int53(nonceA.toNumber() + 1) as Nonce;
        const nonceC = new Int53(nonceA.toNumber() + 2) as Nonce;

        const signedA = await profile.signTransaction(wallet.id, sender, sendA, ethereumCodec, nonceA);
        const signedB = await profile.signTransaction(wallet.id, sender, sendB, ethereumCodec, nonceB);
        const signedC = await profile.signTransaction(wallet.id, sender, sendC, ethereumCodec, nonceC);
        const bytesToPostA = ethereumCodec.bytesToPost(signedA);
        const bytesToPostB = ethereumCodec.bytesToPost(signedB);
        const bytesToPostC = ethereumCodec.bytesToPost(signedC);

        // Post A and B
        const postResultA = await connection.postTx(bytesToPostA);
        await connection.postTx(bytesToPostB);

        // Wait for a block
        await postResultA.blockInfo.waitFor(info => info.state === BcpTransactionState.InBlock);

        // Post C
        await connection.postTx(bytesToPostC);
      })().catch(done.fail);
    }, 60_000);
  });

  describe("liveTx", () => {
    it("can listen to transactions by recipient address (transactions in history and updates)", done => {
      pendingWithoutEthereum();
      pendingWithoutEthereumScraper();

      (async () => {
        const connection = await EthereumConnection.establish(testConfig.base, {
          scraperApiUrl: testConfig.scraper!.apiUrl,
        });

        const recipientAddress = await randomAddress();

        // send transactions

        const profile = new UserProfile();
        const wallet = profile.addWallet(
          Secp256k1HdWallet.fromMnemonic(
            "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
          ),
        );
        const sender = await profile.createIdentity(
          wallet.id,
          testConfig.chainId,
          HdPaths.bip44(60, 0, 0, 1),
        );

        const sendA: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `liveTx() test A ${Math.random()}`,
        };

        const sendB: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `liveTx() test B ${Math.random()}`,
        };

        const sendC: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `liveTx() test C ${Math.random()}`,
        };

        const nonceA = await connection.getNonce({ pubkey: sender.pubkey });
        const nonceB = new Int53(nonceA.toNumber() + 1) as Nonce;
        const nonceC = new Int53(nonceA.toNumber() + 2) as Nonce;

        const signedA = await profile.signTransaction(wallet.id, sender, sendA, ethereumCodec, nonceA);
        const signedB = await profile.signTransaction(wallet.id, sender, sendB, ethereumCodec, nonceB);
        const signedC = await profile.signTransaction(wallet.id, sender, sendC, ethereumCodec, nonceC);
        const bytesToPostA = ethereumCodec.bytesToPost(signedA);
        const bytesToPostB = ethereumCodec.bytesToPost(signedB);
        const bytesToPostC = ethereumCodec.bytesToPost(signedC);

        // Post A and B
        const postResultA = await connection.postTx(bytesToPostA);
        await connection.postTx(bytesToPostB);

        // Wait for a block
        await postResultA.blockInfo.waitFor(info => info.state === BcpTransactionState.InBlock);

        // setup listener after A and B are in block
        const events = new Array<ConfirmedTransaction>();
        const subscription = connection.liveTx({ tags: [scraperAddressTag(recipientAddress)] }).subscribe({
          next: event => {
            events.push(event);

            if (!isSendTransaction(event.transaction)) {
              throw new Error("Unexpected transaction type");
            }
            expect(event.transaction.recipient).toEqual(recipientAddress);

            if (events.length === 3) {
              // This assumes we get two transactions into one block
              // A == B < C
              expect(events[0].height).toEqual(events[1].height);
              expect(events[2].height).toBeGreaterThan(events[1].height);

              subscription.unsubscribe();
              connection.disconnect();
              done();
            }
          },
        });

        // Post C
        await connection.postTx(bytesToPostC);
      })().catch(done.fail);
    }, 60_000);

    it("can listen to transactions by ID (transaction in history)", done => {
      pendingWithoutEthereum();
      pendingWithoutEthereumScraper();

      (async () => {
        const connection = await EthereumConnection.establish(testConfig.base, {
          scraperApiUrl: testConfig.scraper!.apiUrl,
        });

        const profile = new UserProfile();
        const wallet = profile.addWallet(
          Secp256k1HdWallet.fromMnemonic(
            "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
          ),
        );
        const sender = await profile.createIdentity(
          wallet.id,
          testConfig.chainId,
          HdPaths.bip44(60, 0, 0, 1),
        );

        const recipientAddress = await randomAddress();
        const send: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `liveTx() test ${Math.random()}`,
        };

        const nonce = await connection.getNonce({ pubkey: sender.pubkey });
        const signed = await profile.signTransaction(wallet.id, sender, send, ethereumCodec, nonce);
        const bytesToPost = ethereumCodec.bytesToPost(signed);

        const postResult = await connection.postTx(bytesToPost);
        const transactionId = postResult.transactionId;

        // Wait for a block
        await postResult.blockInfo.waitFor(info => info.state === BcpTransactionState.InBlock);

        // setup listener after transaction is in block
        const events = new Array<ConfirmedTransaction>();
        const subscription = connection.liveTx({ id: transactionId }).subscribe({
          next: event => {
            events.push(event);

            if (!isSendTransaction(event.transaction)) {
              throw new Error("Unexpected transaction type");
            }
            expect(event.transaction.recipient).toEqual(recipientAddress);
            expect(event.transactionId).toEqual(transactionId);

            subscription.unsubscribe();
            connection.disconnect();
            done();
          },
        });
      })().catch(done.fail);
    }, 30_000);

    it("can listen to transactions by ID (transaction in updates)", done => {
      pendingWithoutEthereum();
      pendingWithoutEthereumScraper();

      (async () => {
        const connection = await EthereumConnection.establish(testConfig.base, {
          scraperApiUrl: testConfig.scraper!.apiUrl,
        });

        const recipientAddress = await randomAddress();

        // send transactions

        const profile = new UserProfile();
        const wallet = profile.addWallet(
          Secp256k1HdWallet.fromMnemonic(
            "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
          ),
        );
        const sender = await profile.createIdentity(
          wallet.id,
          testConfig.chainId,
          HdPaths.bip44(60, 0, 0, 1),
        );

        const send: SendTransaction = {
          kind: "bcp/send",
          chainId: testConfig.chainId,
          signer: sender.pubkey,
          recipient: recipientAddress,
          amount: defaultAmount,
          gasPrice: testConfig.gasPrice,
          gasLimit: testConfig.gasLimit,
          memo: `liveTx() test ${Math.random()}`,
        };

        const nonce = await connection.getNonce({ pubkey: sender.pubkey });
        const signed = await profile.signTransaction(wallet.id, sender, send, ethereumCodec, nonce);
        const bytesToPost = ethereumCodec.bytesToPost(signed);

        const postResult = await connection.postTx(bytesToPost);
        const transactionId = postResult.transactionId;

        // setup listener before transaction is in block
        const events = new Array<ConfirmedTransaction>();
        const subscription = connection.liveTx({ id: transactionId }).subscribe({
          next: event => {
            events.push(event);

            if (!isSendTransaction(event.transaction)) {
              throw new Error("Unexpected transaction type");
            }
            expect(event.transaction.recipient).toEqual(recipientAddress);
            expect(event.transactionId).toEqual(transactionId);

            subscription.unsubscribe();
            connection.disconnect();
            done();
          },
        });
      })().catch(done.fail);
    }, 30_000);
  });

  describe("getBlockHeader", () => {
    it("can get header from block", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      const blockHeader = await connection.getBlockHeader(0);
      expect(blockHeader.id).toMatch(/^0x[0-9a-f]{64}$/);
      expect(blockHeader.height).toEqual(0);
      expect(blockHeader.transactionCount).toBeGreaterThanOrEqual(0);
      connection.disconnect();
    });

    it("throws error from invalid block number", async () => {
      pendingWithoutEthereum();
      const connection = await EthereumConnection.establish(testConfig.base);
      await connection
        .getBlockHeader(99999999999999)
        .then(() => fail("promise must be rejected"))
        .catch(err => expect(err).toMatch(/Header 99999999999999 doesn't exist yet/));
      connection.disconnect();
    });
  });

  describe("watchBlockHeaders", () => {
    it("watches headers with same data as getBlockHeader", done => {
      pendingWithoutEthereum();

      (async () => {
        const connection = await EthereumConnection.establish(testConfig.base, { wsUrl: testConfig.wsUrl });
        const events = new Array<BlockHeader>();

        const subscription = connection.watchBlockHeaders().subscribe({
          next: async event => {
            try {
              // check this event
              const header = await connection.getBlockHeader(event.height);
              expect(header).toEqual(event);

              // add event
              events.push(event);

              // sum up events
              if (events.length === 2) {
                expect(events[0].height).toEqual(events[1].height - 1);
                subscription.unsubscribe();
                connection.disconnect();
                done();
              }
            } catch (error) {
              done.fail(error);
            }
          },
          complete: done.fail,
          error: done.fail,
        });

        // post transactions
        const wallet = Secp256k1HdWallet.fromMnemonic(
          "oxygen fall sure lava energy veteran enroll frown question detail include maximum",
        );
        const mainIdentity = await wallet.createIdentity(testConfig.chainId, HdPaths.bip44(60, 0, 0, 1));

        const nonceA = await connection.getNonce({ pubkey: mainIdentity.pubkey });
        const nonceB = new Int53(nonceA.toNumber() + 1) as Nonce;
        await postTransaction(wallet, mainIdentity, nonceA, "5445500", connection);
        await postTransaction(wallet, mainIdentity, nonceB, "5445500", connection);
      })().catch(done.fail);
    }, 45_000);
  });
});
