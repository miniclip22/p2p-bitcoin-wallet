const client = require('../../src/config/bitcoin-client');
const {
    createWallet,
    checkBalance,
    sendBitcoin,
    fundWallet,
    generateNewAddress,
} = require('../wallet/wallet');

const WALLET_NAME = process.env.WALLET_NAME || 'mywallet';
const RECIPIENT_WALLET_NAME = 'recipient-wallet';
const INITIAL_BLOCKS = 101;
const INITIAL_AMOUNT = 0.1;

/**
 * Load a wallet by name. If already loaded, skips loading.
 * @param {string} walletName - Name of the wallet to load.
 */
async function loadWallet(walletName) {
    try {
        console.log(`Loading wallet: ${walletName}...`);
        const result = await client.command('loadwallet', walletName);
        console.log(`Wallet "${walletName}" loaded successfully:`, result);
    } catch (error) {
        if (error.code === -35) { // Ignore "wallet already loaded" error
            console.log(`Wallet "${walletName}" is already loaded.`);
        } else {
            console.error(`Error loading wallet "${walletName}":`, error.message);
            throw error; // Re-throw unexpected errors
        }
    }
}

/**
 * Create and fund a wallet with blocks.
 * @param {string} walletName - Name of the wallet to create.
 * @param {number} blocks - Number of blocks to fund the wallet.
 * @returns {Promise<Object>} - The created wallet and its seed.
 */
async function createAndFundWallet(walletName, blocks = INITIAL_BLOCKS) {
    console.log(`===== Creating Wallet: ${walletName} =====`);
    const { wallet, seed } = await createWallet(walletName);
    console.log(`${walletName} initialized with seed:`, seed);

    // Fund the wallet
    console.log(`Funding ${walletName} with ${blocks} blocks...`);
    await fundWallet(walletName, blocks);
    return { wallet, seed };
}

/**
 * Main script that initializes wallets, sends BTC, and checks balances.
 */
(async () => {
    try {
        // Create and fund the sender wallet
        const { wallet: senderWallet, seed: senderSeed } = await createAndFundWallet(WALLET_NAME);

        console.log('\n===== Checking Sender Wallet Initial Balance =====');
        const senderInitialBalance = await checkBalance(WALLET_NAME);
        console.log(`Sender Initial Balance: ${senderInitialBalance} BTC`);

        // Create the recipient wallet
        const { wallet: recipientWallet, seed: recipientSeed } = await createAndFundWallet(RECIPIENT_WALLET_NAME);

        // Load the recipient wallet before generating an address
        console.log('===== Loading Recipient Wallet =====');
        await loadWallet(RECIPIENT_WALLET_NAME);

        // Generate and fund the recipient address
        console.log('\n===== Generating Recipient Address =====');
        const recipientAddress = await generateNewAddress(RECIPIENT_WALLET_NAME);
        console.log(`Recipient Address: ${recipientAddress}`);

        console.log('\n===== Funding Recipient Wallet =====');
        await fundWallet(RECIPIENT_WALLET_NAME, INITIAL_BLOCKS);

        // Send Bitcoin from sender to recipient
        console.log('\n===== Sending Bitcoin =====');
        const txId = await sendBitcoin(WALLET_NAME, recipientAddress, INITIAL_AMOUNT);
        console.log(`Transaction successful! TXID: ${txId}`);

        // Check sender's updated balance
        console.log('\n===== Checking Sender Wallet Updated Balance =====');
        const senderUpdatedBalance = await checkBalance(WALLET_NAME);
        console.log(`Sender Updated Balance: ${senderUpdatedBalance} BTC`);

        // Check recipient's balance
        console.log('\n===== Checking Recipient Wallet Balance =====');
        const recipientBalance = await checkBalance(RECIPIENT_WALLET_NAME);
        console.log(`Recipient Balance: ${recipientBalance} BTC`);

    } catch (error) {
        console.error('Error:', error.message);
    }
})();