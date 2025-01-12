require('dotenv').config(); // Load environment variables
const Client = require('bitcoin-core');
console.log('Current Directory:', __dirname);
require('dotenv').config({ path: `${__dirname}/../../.env` }); // Adjust based on your folder structure
console.log('Environment Variables:', process.env.BITCOIN_NETWORK, process.env.BITCOIN_USERNAME);


/**
 * Initialize and export the Bitcoin RPC client.
 *
 * This client uses the configuration specified in environment variables.
 *
 *
 * @example
 * const client = require('./config/bitcoin-client');
 * const walletInfo = await client.command('getwalletinfo');
 * console.log(walletInfo);
 */

// Default configuration
const DEFAULT_CONFIG = {
    network: 'regtest',
    username: 'user',
    password: 'password',
    host: 'localhost',
    port: 18443,
};

// Initialize Bitcoin RPC client
const client = new Client({
    network: process.env.BITCOIN_NETWORK || DEFAULT_CONFIG.network,
    username: process.env.BITCOIN_USERNAME || DEFAULT_CONFIG.username,
    password: process.env.BITCOIN_PASSWORD || DEFAULT_CONFIG.password,
    host: process.env.BITCOIN_HOST || DEFAULT_CONFIG.host,
    port: parseInt(process.env.BITCOIN_PORT, 10) || DEFAULT_CONFIG.port,
});

module.exports = client;