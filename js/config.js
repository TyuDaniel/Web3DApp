// V4 of TicketToken — final contract version, no further iterations expected.
// Security additions vs V3:
//   - withdraw(): owner pull pattern; deployer calls to drain accumulated SETH.
//     Uses low-level .call{value: balance}("") rather than .transfer() to avoid
//     the 2300 gas cap that breaks smart-contract wallets.
//   - Manual nonReentrant modifier (no OpenZeppelin import) applied to both
//     buyTicket and withdraw. _status uses constants 1/2 (NOT_ENTERED/ENTERED)
//     so every guarded call pays the cheaper warm SSTORE (5k gas) not the cold
//     one (20k gas) that a 0/1 scheme would incur on first call.
//   - Emits Withdrawn(deployer, amount) event on successful withdrawal.
// Deployment tx: 0x85786fc20431c6ac55e740b2a8b45d02fa99c0c6602e0516a2d86e96ee599916
//
// This file is the single source of truth for all front-end pages.
// Update CONTRACT_ADDRESS and ABI here whenever a new version is deployed.

const CONTRACT_ADDRESS = "0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2";
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// NOTE: DEPLOYER_ADDRESS duplicates the contract's private _deployer immutable.
// In a production version we would expose a deployer() public getter on the
// contract and read it from chain via contract.methods.deployer().call().
// Hardcoding here is a deliberate scope decision for this submission — adding
// a getter would require a V5 deploy with full re-setup (approve, top-up, etc).
const DEPLOYER_ADDRESS = "0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB";

const ABI = [
  {
    "inputs": [
      { "internalType": "string",  "name": "_name",        "type": "string"  },
      { "internalType": "string",  "name": "_symbol",      "type": "string"  },
      { "internalType": "uint256", "name": "initialSupply","type": "uint256" },
      { "internalType": "uint256", "name": "_ticketPrice", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "address", "name": "owner",   "type": "address" },
      { "indexed": true,  "internalType": "address", "name": "spender", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value",   "type": "uint256" }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount",  "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "buyTicket",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "amount",    "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "address", "name": "from",  "type": "address" },
      { "indexed": true,  "internalType": "address", "name": "to",    "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "sender",    "type": "address" },
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "amount",    "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "address", "name": "deployer", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount",   "type": "uint256" }
    ],
    "name": "Withdrawn",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner",   "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "ticketPrice",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];
