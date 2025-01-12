const crypto = require('crypto');
const Bip39 = require('../../libs/lib-wallet-seed-bip39');
const { Wallet } = require('../../libs/lib-wallet');
const { WalletStoreHyperbee } = require('../../libs/lib-wallet-store');
const { BitcoinPay } = require('../../libs/lib-wallet-pay-btc');
const client = require('../config/bitcoin-client');
require('dotenv').config({ path: `${__dirname}/../../.env` });

const path = require('path');
const WALLET_NAME = process.env.WALLET_NAME || 'mywallet';
const walletStorePath = path.join(__dirname, '../../wallet-store', WALLET_NAME);


/**
 * Validate the wallet name.
 * @param {string} walletName - Name of the wallet.
 * @throws {Error} If the wallet name is invalid.
 */
function validateWalletName(walletName) {
    if (typeof walletName !== 'string' || walletName.trim() === '') {
        throw new Error('Invalid wallet name. It must be a non-empty string.');
    }
}

/**
 * Validate the amount for a transaction.
 * @param {number} amount - The amount to validate.
 * @throws {Error} If the amount is invalid.
 */
function validateAmount(amount) {
    if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount. It must be a positive number.');
    }
}

/**
 * Load a wallet into Bitcoin Core.
 * @param {string} walletName - The name of the wallet to load.
 * @returns {Promise<void>}
 */
async function loadWallet(walletName) {
    try {
        console.log(`Loading wallet: ${walletName}...`);
        const result = await client.command('loadwallet', walletName);
        console.log(`Wallet "${walletName}" loaded successfully:`, result);
    } catch (error) {
        if (error.code === -35) { // Wallet already loaded
            console.log(`Wallet "${walletName}" is already loaded.`);
        } else {
            console.error(`Error loading wallet "${walletName}":`, error.message);
            throw error; // Re-throw unexpected errors
        }
    }
}

/**
 * Ensure a wallet exists in Bitcoin Core.
 * @param {string} walletName - The name of the wallet.
 * @throws {Error} If an unexpected error occurs while checking or creating the wallet.
 */
async function ensureWalletExists(walletName) {
    try {
        await client.command('loadwallet', walletName);
        console.log(`Wallet "${walletName}" loaded successfully.`);
    } catch (error) {
        if (error.code === -18) { // Wallet does not exist
            console.log(`Wallet "${walletName}" does not exist. Creating it in Bitcoin Core...`);
            const result = await client.command('createwallet', walletName);
            console.log(`Wallet "${walletName}" created in Bitcoin Core:`, result);
        } else if (error.code === -35) { // Wallet already loaded
            console.log(`Wallet "${walletName}" is already loaded.`);
        } else {
            throw error;
        }
    }
}

/**
 * Get or generate a wallet seed.
 * @param {WalletStoreHyperbee} store - The wallet store instance.
 * @param {string} walletName - The name of the wallet.
 * @returns {string} The wallet seed.
 */
async function getWalletSeed(store, walletName) {
    let seed = store.seed;
    if (!seed) {
        seed = await Bip39.generate();
        console.log(`Generated new seed for wallet: ${walletName}`);
    } else {
        console.log(`Loaded existing seed for wallet: ${walletName}`);
    }
    return seed;
}

/**
 * Create and initialize a wallet.
 * @param {string} walletName - The name of the wallet.
 * @returns {Promise<{wallet: Wallet, seed: string}>} The wallet and its seed.
 */
async function createWallet(walletName) {
    try {
        validateWalletName(walletName);
        console.log(`Initializing wallet: ${walletName}`);

        console.log('Setting up wallet store...');
        const store = new WalletStoreHyperbee({store_path:walletStorePath});
        console.log(walletStorePath);

        const seed = await getWalletSeed(store, walletName);

        console.log('Configuring BitcoinPay asset...');
        const btcPay = new BitcoinPay({
            asset_name: 'btc',
            network: 'regtest',
            provider: { rpc: client },
            seed,
        });

        console.log('Initializing wallet...');
        const wallet = new Wallet({
            store,
            seed,
            assets: [btcPay],
        });

        await wallet.initialize();
        console.log('Wallet initialized successfully.');

        return { wallet, seed };
    } catch (error) {
        console.error(`Error creating wallet "${walletName}":`, error.message);
        throw error;
    }
}

/**
 * Send BTC from one wallet to a recipient address.
 * @param {string} walletName - The name of the sender's wallet.
 * @param {string} recipientAddress - The recipient's Bitcoin address.
 * @param {number} amount - The amount to send.
 * @returns {Promise<string>} The transaction ID.
 */
async function sendBitcoin(walletName, recipientAddress, amount) {
    try {
        validateWalletName(walletName);
        validateAmount(amount);

        console.log(`Sending ${amount} BTC from wallet "${walletName}" to ${recipientAddress}...`);
        client.wallet = walletName;

        const txId = await client.command('sendtoaddress', recipientAddress, amount);
        console.log(`Transaction sent successfully. TXID: ${txId}`);
        return txId;
    } catch (error) {
        console.error(`Error sending BTC from wallet "${walletName}":`, error.message);
        throw error;
    }
}

/**
 * Fund a wallet with test BTC by mining blocks.
 * @param {string} walletName - The name of the wallet.
 * @param {number} [numberOfBlocks=101] - The number of blocks to mine.
 * @returns {Promise<void>}
 */
async function fundWallet(walletName, numberOfBlocks = 101) {
    try {
        validateWalletName(walletName);
        console.log(`Funding wallet "${walletName}" with ${numberOfBlocks} blocks...`);

        await ensureWalletExists(walletName);

        client.wallet = walletName;

        const miningAddress = await client.command('getnewaddress');
        console.log(`Mining rewards will be sent to address: ${miningAddress}`);

        const blockHashes = await client.command('generatetoaddress', numberOfBlocks, miningAddress);
        console.log(`Generated ${blockHashes.length} blocks. Mining rewards added to wallet.`);
    } catch (error) {
        console.error(`Error funding wallet "${walletName}":`, error.message);
        throw error;
    }
}

/**
 * Check the balance of a wallet.
 * @param {string} walletName - The name of the wallet.
 * @returns {Promise<number>} The wallet's balance in BTC.
 */
async function checkBalance(walletName) {
    try {
        validateWalletName(walletName);
        console.log(`Ensuring wallet "${walletName}" is loaded...`);
        client.wallet = walletName;

        const balance = await client.command('getbalance');
        console.log(`Wallet Balance (${walletName}): ${balance} BTC`);
        return balance;
    } catch (error) {
        console.error(`Error fetching balance for wallet "${walletName}":`, error.message);
        throw error;
    }
}

/**
 * Generate a new Bitcoin address for a wallet.
 * @param {string} walletName - The name of the wallet.
 * @returns {Promise<string>} The new Bitcoin address.
 */
async function generateNewAddress(walletName) {
    try {
        validateWalletName(walletName);
        console.log(`Generating a new Bitcoin address for wallet: ${walletName}...`);
        client.wallet = walletName;

        const newAddress = await client.command('getnewaddress', '', 'bech32');
        console.log(`New Bitcoin address: ${newAddress}`);
        return newAddress;
    } catch (error) {
        console.error(`Error generating new address for wallet "${walletName}":`, error.message);
        throw error;
    }
}

module.exports = {
    createWallet,
    checkBalance,
    sendBitcoin,
    fundWallet,
    generateNewAddress,
    ensureWalletExists,
    loadWallet
};