const client = require('../src/config/bitcoin-client');
const { createWallet, checkBalance, fundWallet, sendBitcoin, loadWallet } = require('../src/wallet/wallet');

const peerCount = 5; // Number of peers to initialize
const peers = []; // To store peers and their data

/**
 * Retry function with exponential backoff for RPC commands.
 * @param {Function} fn - Function to retry.
 * @param {number} retries - Maximum number of retries.
 * @param {number} delay - Initial delay in milliseconds.
 * @returns {Promise<any>} - Resolved value from the function.
 */
async function retryWithBackoff(fn, retries = 5, delay = 500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === retries) throw error;
            console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
            await new Promise((res) => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
        }
    }
}

/**
 * Main script to perform stress testing for Bitcoin wallet transactions.
 */
(async () => {
    try {
        // Step 1: Initialize Peers
        for (let i = 1; i <= peerCount; i++) {
            const walletName = `peer-wallet-${i}`;

            // Create a new wallet for the peer
            console.log(`Creating wallet for ${walletName}...`);
            const { wallet, seed } = await createWallet(walletName);
            console.log(`Wallet "${walletName}" initialized with seed:`, seed);

            // Load the wallet to make sure it is available for operations
            console.log(`Loading wallet "${walletName}"...`);
            await loadWallet(walletName);

            // Generate a new Bitcoin address for the wallet
            client.wallet = walletName; // Set the wallet in the client
            const recipientAddress = await client.command('getnewaddress', '', 'bech32');
            console.log(`Generated recipient address for ${walletName}: ${recipientAddress}`);

            peers.push({ walletName, recipientAddress });
        }

        console.log(`Initialized ${peers.length} peers.`);

        // Step 2: Fund Wallets
        for (const peer of peers) {
            console.log(`Funding wallet "${peer.walletName}"...`);
            client.wallet = peer.walletName; // Set the wallet in the client
            await fundWallet(peer.walletName, 500);
        }

        // Step 3: Transaction Testing
        for (let i = 0; i < peerCount; i++) {
            const sender = peers[i];
            const recipient = peers[(i + 1) % peerCount]; // Send to the next peer in the list
            const amountToSend = 0.01;

            client.wallet = sender.walletName; // Set the wallet in the client
            console.log(`Sending ${amountToSend} BTC from ${sender.walletName} to ${recipient.recipientAddress}...`);
            const txId = await sendBitcoin(sender.walletName, recipient.recipientAddress, amountToSend);
            console.log(`Transaction successful! TXID: ${txId}`);
        }

        // Step 4: Check Balances
        for (const peer of peers) {
            client.wallet = peer.walletName; // Set the wallet in the client
            const balance = await checkBalance(peer.walletName);
            console.log(`Balance for ${peer.walletName}: ${balance} BTC`);
        }
    } catch (error) {
        console.error('Error in stress test:', error.message);
    }
})();