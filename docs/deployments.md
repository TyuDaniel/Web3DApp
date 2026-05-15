# Sepolia Deployment History

All deployments to Ethereum Sepolia testnet via Remix IDE → Injected
Provider → MetaMask. Each version represents a deliberate iteration
documented in `docs/ai-chatlogs/`.

---

## V1 — Base ERC-20 (initial test)

Throwaway test deployment to confirm the base ERC-20 logic worked
end-to-end before adding optimisations or the payable extension.
Specific tx hash and address not preserved — was treated as a
throwaway test and superseded within the same working session.

---

## V2 — Gas-optimised ERC-20

Added `immutable` on `decimals` and `_totalSupply` (saves ~2,100 gas
per read by baking the value into bytecode rather than reading from
storage). Removed dead `msg.sender != address(0)` check in `approve`
(`msg.sender` cannot be the zero address — the EVM does not permit
zero-address signed transactions, so the check was decorative dead
code).

| Field | Value |
|-------|-------|
| Address | [0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8](https://sepolia.etherscan.io/address/0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8) |
| Constructor params | name="TicketToken", symbol="TKT", initialSupply=100 |
| State | Superseded by V3 (added buyTicket) |

---

## V3 — Adds payable buyTicket extension

The SETH purchase function. Caller sends exactly `ticketPrice`
(immutable, set in constructor). Contract uses Checks-Effects-
Interactions ordering: check `msg.value` matches `ticketPrice` →
check the deployer's allowance → decrement allowance → transfer the
ticket via internal `_transfer`.

Tickets remain in the deployer's wallet rather than the contract's;
the contract operates on the deployer's behalf via a one-time
`approve(contractAddress, fullSupply)` post-deploy.

Inline allowance manipulation chosen over `this.transferFrom(...)`
for two reasons: ~2,600 gas saving (no external CALL overhead), and
clarity (`this.foo()` on the same contract reads as a code smell).

| Field | Value |
|-------|-------|
| Address | [0x04c7aA0AaFE789F10bC239383839469DA74FdB59](https://sepolia.etherscan.io/address/0x04c7aA0AaFE789F10bC239383839469DA74FdB59) |
| Constructor params | name="TicketToken", symbol="TKT", initialSupply=100, ticketPrice=10000000000000000 (0.01 SETH) |
| Successful buyTicket tx | [0x47f4b755f3d8317b9726e425519cdb619c59d64358eea2679d7f1f842db17217](https://sepolia.etherscan.io/tx/0x47f4b755f3d8317b9726e425519cdb619c59d64358eea2679d7f1f842db17217) |
| Buy block | 10749011 |
| Buy gas used | 56,976 |
| State | Superseded by V4 (added withdraw + reentrancy guard) |

---

## V4 — Final Deployment ⬅ LIVE CONTRACT

This is the contract all frontend pages run against. All four pages
point at this address via `js/config.js`.

### What changed from V3

- Added `withdraw()` — deployer pulls accumulated SETH out of the
  contract. Uses low-level `.call{value: balance}("")` instead of
  `.transfer()` to avoid the 2300 gas cap that breaks smart-contract
  wallets. Emits `Withdrawn(deployer, amount)` event.
- Added manual `nonReentrant` modifier (no OpenZeppelin import).
  Uses constants `NOT_ENTERED = 1` / `ENTERED = 2` instead of 0/1
  so every guarded call pays the cheaper warm SSTORE (5k gas) not
  the cold 0-to-nonzero write (20k gas).
- Applied `nonReentrant` to both `buyTicket` and `withdraw`.
  `withdraw` is the actual reentrancy vector; `buyTicket` is
  defence-in-depth.
- ticketPrice reduced from 0.01 SETH (V3) to 0.000001 SETH for
  Sepolia testing economy. Contract logic is identical.

### Contract details

| Field | Value |
|-------|-------|
| Address | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) |
| Constructor params | name="TicketTokenV4", symbol="TKT", initialSupply=100, ticketPrice=1000000000000 wei (0.000001 SETH) |
| State | **Current production deployment** |

---

### Transaction evidence

#### 1. Deployment
Constructor minted 100 tickets (100 × 10^18 token units) to the
deployer and emitted Transfer from address(0).

| | |
|--|--|
| Tx | [0x85786fc20431c6ac55e740b2a8b45d02fa99c0c6602e0516a2d86e96ee599916](https://sepolia.etherscan.io/tx/0x85786fc20431c6ac55e740b2a8b45d02fa99c0c6602e0516a2d86e96ee599916) |
| From | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) (deployer) |
| Block | 10806852 |
| Status | ✅ Success |

#### 2. Approve setup
Deployer authorised the contract to move tickets from the deployer's
wallet on behalf of buyers. Without this transaction every call to
`buyTicket()` reverts with "no tickets available".

| | |
|--|--|
| Tx | [0xeef8cc3f327efad7e831b510014c94529fd53557d3a32ee1a1714ba29b05463f](https://sepolia.etherscan.io/tx/0xeef8cc3f327efad7e831b510014c94529fd53557d3a32ee1a1714ba29b05463f) |
| From | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) (deployer) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ✅ Success |

#### 3. Successful buyTicket — via Remix
Early test buy done directly via Remix during V4 contract testing.
Proves the contract-level buy flow works independently of the
frontend.

| | |
|--|--|
| Tx | [0x0f431f7d52cb1b2be1f95aa045e067dd9194677d69b88af582cae6b5722b5669](https://sepolia.etherscan.io/tx/0x0f431f7d52cb1b2be1f95aa045e067dd9194677d69b88af582cae6b5722b5669) |
| From | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) (deployer) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ✅ Success |

#### 4. Successful buyTicket — via frontend
Buy completed through buy.html. Keystore wallet unlocked locally via
web3.eth.accounts.decrypt, transaction signed client-side, broadcast
to Sepolia. Proves the full frontend stack works end-to-end.

| | |
|--|--|
| Tx | [0x6023dd36578f0c0fddaebaed32d5d689d19fdc0fe26c9827b2a5f89e7f97f4d4](https://sepolia.etherscan.io/tx/0x6023dd36578f0c0fddaebaed32d5d689d19fdc0fe26c9827b2a5f89e7f97f4d4) |
| From | [0x75F3d75BC22A7A06fa7825556665a7E69790E68a](https://sepolia.etherscan.io/address/0x75F3d75BC22A7A06fa7825556665a7E69790E68a) (keystore buyer) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ✅ Success |

#### 5. Successful transfer — via frontend
Ticket transferred back to vendor (deployer) using transfer.html.
Same keystore wallet unlocked, ERC-20 transfer() called with
DEPLOYER_ADDRESS as recipient. Buyer ticket balance dropped from
1 to 0; deployer balance increased by 1.

| | |
|--|--|
| Tx | [0x7d55e4b6cd28101fd5a5fc506622885ea46e440c630c3610813ddb110456236e](https://sepolia.etherscan.io/tx/0x7d55e4b6cd28101fd5a5fc506622885ea46e440c630c3610813ddb110456236e) |
| From | [0x75F3d75BC22A7A06fa7825556665a7E69790E68a](https://sepolia.etherscan.io/address/0x75F3d75BC22A7A06fa7825556665a7E69790E68a) (keystore buyer) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ✅ Success |

#### 6. Successful withdraw
Deployer called withdraw() to pull accumulated SETH from ticket sales
out of the contract. Contract balance dropped to 0; deployer received
0.000005 SETH (5 test buys × 0.000001 SETH each).

| | |
|--|--|
| Tx | [0xd60ae875c55dc3d41331a1e1df99c234bcdc6bc842dacd9b599d05975e6f5ebd](https://sepolia.etherscan.io/tx/0xd60ae875c55dc3d41331a1e1df99c234bcdc6bc842dacd9b599d05975e6f5ebd) |
| From | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) (deployer) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ✅ Success |

#### 7. Buy revert — incorrect payment
Deliberately sent 500000000000 wei (half the ticket price) to prove
the contract rejects underpayment.

| | |
|--|--|
| Tx | [0x76092608463a44c80744d96cf0e5b37ca7b2642164949ccf83002c084b8a496b](https://sepolia.etherscan.io/tx/0x76092608463a44c80744d96cf0e5b37ca7b2642164949ccf83002c084b8a496b) |
| From | [0x31447Cb490216109B1D49096793A3a4268827FfB](https://sepolia.etherscan.io/address/0x31447Cb490216109B1D49096793A3a4268827FfB) (purchaser) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ❌ Fail — `TicketToken: incorrect payment` |

#### 8. Withdraw revert — non-deployer caller
Purchaser attempted to call withdraw() to confirm access control.
Only the deployer can withdraw.

| | |
|--|--|
| Tx | [0xa289f3421cbaa958505f9a5390a7ac9f74540e2daeaa42996f1d2d262dd36c72](https://sepolia.etherscan.io/tx/0xa289f3421cbaa958505f9a5390a7ac9f74540e2daeaa42996f1d2d262dd36c72) |
| From | [0x31447Cb490216109B1D49096793A3a4268827FfB](https://sepolia.etherscan.io/address/0x31447Cb490216109B1D49096793A3a4268827FfB) (purchaser) |
| To | [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2) (contract) |
| Status | ❌ Fail — `TicketToken: only deployer` |

---

## Wallet addresses

### Deployer

Deployed the contract and holds the full ticket supply. Also acts as
vendor — receives transferred tickets and SETH revenue via withdraw().
Funded via Sepolia faucet prior to deployment; wallet activity
confirms funding via deployment tx above.

| | |
|--|--|
| Address | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) |

### Keystore buyer

Generated via the create-wallet page. Used to test the buy and
transfer frontend flows end-to-end.

| | |
|--|--|
| Address | [0x75F3d75BC22A7A06fa7825556665a7E69790E68a](https://sepolia.etherscan.io/address/0x75F3d75BC22A7A06fa7825556665a7E69790E68a) |
| Top-up tx | [0x06e09c8f8e2ca08746ddf987e362f5375313afbbe678e187a9a7a551be39c1cd](https://sepolia.etherscan.io/tx/0x06e09c8f8e2ca08746ddf987e362f5375313afbbe678e187a9a7a551be39c1cd) |
| Amount | 0.03 SETH |
| Funded by | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) (deployer) |

### Vendor / doorman

The vendor is the deployer in this single-event design. The deployer
receives transferred tickets and SETH revenue via withdraw(). This
decision is justified in the report's design section.

| | |
|--|--|
| Address | [0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB](https://sepolia.etherscan.io/address/0x4c6A154131C03f5A60BEA08Ae2099f420145c3dB) |
