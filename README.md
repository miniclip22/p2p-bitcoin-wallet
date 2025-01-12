# P2P Bitcoin Wallet

## Overview

This project is a coding challenge for Tether, focusing on building a peer-to-peer Bitcoin wallet system. The goal is to showcase expertise in distributed systems and cryptocurrency implementations. The system enables multiple devices to securely share and synchronize a Bitcoin wallet using a decentralized architecture.

This README describes the design, usage, missing components, and areas for improvement.

---

## Pre-requisites

1. **bitcoind** setup correctly and running in `regtest` mode.
2. A properly configured `bitcoin.conf` file with RPC settings.
3. **Node.js** installed (v14 or higher recommended).
4. **Python 3** installed (required for building some native modules).
5. A `libs/` folder containing the following [Tetherto](https://github.com/tetherto) repositories cloned:
  - [lib-wallet](https://github.com/tetherto/lib-wallet)
  - [lib-wallet-pay-btc](https://github.com/tetherto/lib-wallet-pay-btc)
  - [lib-wallet-seed-bip39](https://github.com/tetherto/lib-wallet-seed-bip39)
  - [lib-wallet-store](https://github.com/tetherto/lib-wallet-store)

---

## System Overview

### Functional Requirements
- Generate and securely manage wallet seeds.
- Generate new Bitcoin addresses.
- Send and receive Bitcoin transactions.
- Retrieve wallet balances.
- Synchronize wallet state between devices in a distributed setup.

### Rationale

The implementation was approached in two phases:
1. **Local Wallet**: Implement the wallet with the above features operating on a single system.
2. **Distributed Wallet**: Extend the functionality to work in a decentralized, peer-to-peer manner using Hyperswarm.

---

## Design and Architecture

### Local Wallet

The **Local Wallet** implementation interacts directly with `bitcoind` via its RPC interface. It supports:
- Wallet creation and initialization.
- Sending and receiving transactions.
- Querying wallet balance.

### Distributed Wallet

The **Distributed Wallet** builds on the local wallet by introducing peer-to-peer synchronization via Hyperswarm. Peers share wallet state, propagate transactions, and synchronize balances over the network.

---

## Folder Structure

```plaintext
.
├── package-lock.json
├── package.json
├── libs                            # Contains cloned Tetherto libraries
│   ├── lib-wallet                  # Core wallet library
│   ├── lib-wallet-pay-btc          # Bitcoin payment implementation
│   ├── lib-wallet-seed-bip39       # BIP39 seed generation library
│   └── lib-wallet-store            # Wallet storage implementation
├── src
│   ├── config
│   │   └── bitcoin-client.js       # Configures the Bitcoin RPC client
│   └── scripts
│       ├── p2p
│       │   └── run-bitcoin-wallet-distributed.js   # Implements the distributed wallet functionality
│       └── run-bitcoin-wallet-locally.js           # Implements the local wallet functionality
│   └── wallet
│       └── wallet.js               # Core wallet logic, including initialization, transactions, and balance checks
├── test
│   └── stress-test.js              # Simulates multiple peers interacting with the wallet
└── wallet-store
    └── <wallet data storage>
```

## Setup and Usage

1. **Clone the repository**:
   ```bash
   git clone https://github.com/miniclip22/p2p-bitcoin-wallet
   cd p2p-bitcoin-wallet
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install dependencies for Tetherto libraries**:
Navigate to each library folder inside the libs/ directory and install its dependencies:
   ```bash
   mkdir libs && cd libs && git clone https://github.com/tetherto/lib-wallet.git && cd lib-wallet && npm install && cd .. && git clone https://github.com/tetherto/lib-wallet-pay-btc.git && cd lib-wallet-pay-btc && npm install && cd .. && git clone https://github.com/tetherto/lib-wallet-seed-bip39.git && cd lib-wallet-seed-bip39 && npm install && cd .. && git clone https://github.com/tetherto/lib-wallet-store.git && cd lib-wallet-store && npm install
   ```
   
5. **Copy** .env.example **to** .env:
   ```bash
    cp .env.example .env
    ``` 

Update .env with your configuration, especially the Bitcoin client RPC settings.

5. **Start bitcoind in regtest mode:**
   Ensure bitcoind is running with RPC enabled and configured for regtest.
6. **Run the local wallet:**
   ```bash
   node src/scripts/run-bitcoin-wallet-locally.js
   ```
7. **Run the distributed wallet:**
    ```bash
   node src/scripts/p2p/run-bitcoin-wallet-distributed.js
   ```
**Note:** To test the distributed wallet, run the same script in multiple terminal windows simultaneously. This simulates multiple peers interacting with the wallet.

# Testing

1. **Run all tests**
    ```bash
    npm test
    ``` 
2. **Run stress test**
    ```bash
     npm run test:stress-test
   ```
This test simulates multiple peers interacting with the wallet.

## Missing Components and Areas for Improvement

### Hypercore Integration
Hypercore integration was planned to log wallet activity and provide a distributed append-only log. Due to time constraints, this feature was not implemented. Console logs will eventually be replaced with Hypercore logs to enable a more robust and decentralized logging mechanism.

### Electrum Server Integration
The current implementation relies on **bitcoind**'s RPC interface, but components like the BitcoinPay asset in `lib-wallet-pay-btc` expect a provider implementing the `isConnected` function. Integrating an Electrum Server would resolve this incompatibility and improve wallet interoperability by providing additional API methods for querying wallet states and transactions.

---

## Troubleshooting and Known Issues

### Error: `this.provider.isConnected is not a function`
- **Cause**: Missing Electrum Server integration. The BitcoinPay asset in `lib-wallet-pay-btc` expects a provider implementing the `isConnected` function. The current implementation uses **bitcoind**’s RPC API, which does not fulfill this requirement.
- **Solution**: Integrate an Electrum Server and adapt the provider model for compatibility.
- **Impact**: Despite this error, all scripts run as intended and meet the functional requirements of the coding challenge.
