const Hyperswarm = require('hyperswarm');
const crypto = require('crypto');
const client = require('../../config/bitcoin-client');
const {
    createWallet,
    sendBitcoin,
    fundWallet,
    checkBalance,
    generateNewAddress,
} = require('../../wallet/wallet.js');
require('dotenv').config({path: `${__dirname}/../../.env`});

// Configuration
const WALLET_NAME = process.env.WALLET_NAME || 'mywallet';
const INITIAL_BLOCKS = parseInt(process.env.INITIAL_BLOCKS, 10) || 101;
const INITIAL_AMOUNT = parseFloat(process.env.INITIAL_AMOUNT) || 0.1;
const MAX_RETRIES = 5;
const SWARM_TOPIC = crypto.createHash('sha256').update('p2p-bitcoin-wallet').digest();

// Configure Hyperswarm
const swarm = new Hyperswarm();
swarm.join(SWARM_TOPIC, {
    lookup: true,
    announce: true,
});

// Local wallet state
let currentBalance = 0;
const transactionHistory = [];

/**
 * Retry function with exponential backoff for RPC commands.
 * @param {Function} fn - Function to retry.
 * @param {number} retries - Maximum number of retries.
 * @param {number} delay - Initial delay in milliseconds.
 * @returns {Promise<any>} - Resolved value from the function.
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES, delay = 500) {
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
 * Verify if a transaction has been confirmed or added to the mempool.
 * @param {string} txId - Transaction ID to verify.
 * @returns {Promise<boolean>} - True if the transaction is valid, otherwise false.
 */
async function verifyTransaction(txId) {
    try {
        const txDetails = await retryWithBackoff(() => client.command('gettransaction', txId));
        console.log(`Transaction ${txId} verified:`, txDetails);
        return true;
    } catch (error) {
        console.error(`Failed to verify transaction ${txId}:`, error.message);
        return false;
    }
}

/**
 * Broadcast the current wallet state to a peer.
 * @param {object} connection - Peer connection instance.
 */
function broadcastState(connection) {
    const walletState = {
        type: 'state',
        data: {
            walletName: WALLET_NAME,
            balance: currentBalance,
            transactions: transactionHistory,
        },
    };
    connection.write(JSON.stringify(walletState));
}

/**
 * Handle incoming peer connections.
 * @param {object} connection - Peer connection instance.
 */
function handlePeerConnection(connection) {
    console.log('New peer connected!');

    let malformedMessagesCount = 0;

    // Send initial state to the peer
    broadcastState(connection);

    connection.on('data', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received message from peer:', message);

            if (message.type === 'transaction') {
                const {sender, recipient, amount, txId} = message.data;
                console.log(`Received transaction: TXID=${txId}, Sender=${sender}, Recipient=${recipient}, Amount=${amount}`);
                transactionHistory.push(message.data);
            } else if (message.type === 'state-request') {
                console.log('Received state request. Sending state to peer.');
                broadcastState(connection);
            } else if (message.type === 'state') {
                console.log('Received wallet state from peer:', message.data);

                // Example: Validate and synchronize balances
                if (message.data.balance > currentBalance) {
                    console.log('Updating local state with the received state...');
                    currentBalance = message.data.balance;
                    transactionHistory.push(...message.data.transactions);
                }
            } else {
                console.warn('Unknown message type received:', message.type);
            }
        } catch (error) {
            malformedMessagesCount++;
            console.error('Error processing peer message:', error.message);

            if (malformedMessagesCount > 3) {
                console.warn('Too many malformed messages. Closing connection...');
                connection.destroy();
            }
        }
    });

    connection.on('close', () => {
        console.log('Peer disconnected.');
    });
}

// Attach peer connection handler
swarm.on('connection', handlePeerConnection);

// Handle swarm errors
swarm.on('error', (error) => {
    console.error('Swarm error:', error);
});

/**
 * Initialize wallet and perform initial funding and transactions.
 *
 * Workflow:
 * 1. **Initialize Wallet**:
 *    - The script uses the specified wallet name from the `.env` file or defaults to `'mywallet'`.
 *    - If the wallet does not exist, it will be created.
 *    - A seed will be generated or loaded from the wallet store.
 *
 * 2. **Fund Wallet**:
 *    - The wallet is funded by mining a specified number of blocks (default: `101`).
 *    - Mining rewards are added to the wallet's balance.
 *
 * 3. **Check Initial Balance**:
 *    - The wallet's current balance is retrieved and logged.
 *
 * 4. **Generate Recipient Address**:
 *    - A new Bitcoin address is generated from the same wallet.
 *    - This address will act as the recipient for the test transaction.
 *
 * 5. **Send Bitcoin**:
 *    - A specified amount of BTC (default: `0.1`) is sent from the wallet to the recipient address.
 *    - The transaction is created, broadcasted to the Bitcoin network, and logged.
 *
 * 6. **Verify Transaction**:
 *    - The transaction ID (`txId`) is verified for confirmation or inclusion in the mempool.
 *    - If the transaction cannot be verified, a warning is logged.
 *
 * 7. **Propagate Transaction to Peers**:
 *    - The transaction details (sender, recipient, amount, and txId) are broadcasted to all connected peers using Hyperswarm.
 *
 * 8. **Check Updated Balance**:
 *    - The wallet's updated balance is retrieved and logged after the transaction.
 *
 * 9. **Handle Peer Connections**:
 *    - Connected peers can request wallet state or send transactions.
 *    - The script synchronizes wallet states if a peer's balance exceeds the local balance.
 *
 * @async
 * @throws {Error} Logs and halts execution in case of critical errors.
 */
(async () => {
    try {
        console.log('===== Initializing Wallet =====');
        const {wallet, seed} = await createWallet(WALLET_NAME);
        console.log(`Wallet "${WALLET_NAME}" initialized with seed:`, seed);

        console.log('Funding wallet...');
        await fundWallet(WALLET_NAME, INITIAL_BLOCKS);

        console.log('\n===== Checking Initial Balance =====');
        currentBalance = await checkBalance(WALLET_NAME);
        console.log(`Initial Balance: ${currentBalance} BTC`);

        console.log('\n===== Generating Recipient Address =====');
        const recipientAddress = await generateNewAddress(WALLET_NAME);
        console.log(`Recipient Address: ${recipientAddress}`);

        console.log('\n===== Sending Bitcoin =====');
        const txId = await sendBitcoin(WALLET_NAME, recipientAddress, INITIAL_AMOUNT);
        console.log(`Transaction successful! TXID: ${txId}`);

        // Verify transaction
        const isVerified = await verifyTransaction(txId);
        if (!isVerified) {
            console.warn(`Transaction ${txId} could not be verified.`);
        }

        // Propagate transaction to peers
        const transaction = {
            type: 'transaction',
            data: {
                sender: WALLET_NAME,
                recipient: recipientAddress,
                amount: INITIAL_AMOUNT,
                txId,
            },
        };
        console.log('Broadcasting transaction to peers:', transaction);
        swarm.connections.forEach((conn) => conn.write(JSON.stringify(transaction)));

        console.log('\n===== Checking Updated Balance =====');
        currentBalance = await checkBalance(WALLET_NAME);
        console.log(`Updated Balance: ${currentBalance} BTC`);
    } catch (error) {
        console.error('Error in main flow:', error.message);
        console.error(error.stack);
    }
})();