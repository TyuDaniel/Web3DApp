**Student:** Daniel Tyutyunkov
**Contract:** [0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2](https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2)  
**Network:** Ethereum Sepolia Testnet  
**Date:** May 2026

## 1. Project Overview

This project is a Web3 ticketing DApp for a single event. A user can create a wallet, buy one ERC-20 ticket with Sepolia ETH, check ticket status, and transfer the ticket back to the venue operator. The contract holds the sale logic and ticket token rules, while the frontend keeps the flow simple enough to run from a browser.

The stack is Ethereum Sepolia, Solidity 0.8.20, web3.js 1.10.4, and plain HTML/CSS/JavaScript served through VS Code Live Server. It uses a keystore-based wallet flow rather than MetaMask because that matches the course tutorial pattern and fits the create-wallet to buy loop the system is designed around.

## 2. Contract Architecture — V1 to V4

V1 was the base ERC-20 skeleton. It minted the full supply to the deployer in the constructor and was used as a test deployment to confirm the base token logic before extending it. I did not preserve the address because the point of this version was only to prove that the ERC-20 structure worked before adding sale logic.

V2 was a gas optimisation pass. I added `immutable` to `decimals` and `_totalSupply`, which saves about 2,100 gas per read by baking those values into bytecode instead of reading from storage. I also removed the dead `msg.sender != address(0)` check in `approve`, because `msg.sender` can never be the zero address; the EVM does not permit zero-address signed transactions.

V3 added payable `buyTicket()`. Tickets stay in the deployer's wallet, and the contract operates through a one-time `approve(contract, fullSupply)` call after deployment. I chose inline allowance manipulation instead of `this.transferFrom()` for two reasons: it saves ~2,600 gas by avoiding external `CALL` overhead, and `this.foo()` on your own contract reads as a code smell. The function follows CEI ordering: check `msg.value`, check and decrement allowance, then transfer the ticket.

V4 added `withdraw()` and a manual `nonReentrant` guard. `withdraw()` uses `.call{value: balance}("")` instead of `.transfer()` to avoid the 2300 gas cap that can break smart-contract wallets. The reentrancy guard uses `NOT_ENTERED = 1` and `ENTERED = 2` instead of a 0/1 pattern, because warm `SSTORE` costs 5k gas rather than 20k, making every guarded call cheaper. I applied the guard to both `buyTicket()` as defence-in-depth and `withdraw()` as the actual reentrancy vector.

## 3. Frontend Architecture

The create-wallet page follows Andy Legear's createWallet tutorial pattern. It uses `web3.eth.accounts.create()` and `encrypt()` to generate a wallet and produce a downloadable keystore JSON. The private key is hidden behind a reveal toggle rather than being shown automatically, because the safest default is to keep it out of sight unless the user asks for it. The downloaded filename includes the address prefix and a timestamp. The page is pinned to `web3@1.10.4` instead of tracking the latest CDN build, which keeps the tutorial behaviour stable.

The balance page has three role-distinct views rather than one generic balance screen. The attendee view gives plain prose, such as "you hold N tickets", because that is the information an attendee needs. The doorman view returns a binary pass/fail badge and does not show a numeric balance, because a doorman needs a fast yes/no at the door, not token accounting. The venue view shows a 2x2 stats grid reading `totalSupply`, deployer balance, and `web3.eth.getBalance(contractAddress)` for accumulated revenue. It uses `Promise.all` so the chain reads happen in parallel rather than one after another.

The buy page is built around a six-state flow: idle, unlocking, unlocked, estimating, pending, and success/error. The keystore is uploaded through a file input rather than pasted into a textarea, which matches the download flow from the create-wallet page. Once decrypted, the unlocked account stays in memory while the page is open. That avoids repeated slow scrypt decrypts, but it means the private key is present in JavaScript memory during the session. The page also warns on `beforeunload` while a transaction is pending.

The transfer page uses the same keystore unlock pattern as the buy page. The vendor address is `DEPLOYER_ADDRESS` from `config.js`, so it is hardcoded and not editable by the user. That removes a common error path: the return flow should always send the ticket back to the venue operator. The amount is fixed to one ticket, and the code performs a defensive check before signing even though the button is disabled until the form is valid. It is a belt and braces check because transaction signing is where mistakes become expensive.

## 4. Design Decisions and Trade-offs

`DEPLOYER_ADDRESS` is hardcoded in `config.js` because the contract stores `_deployer` as a private immutable and does not expose a public getter. Ideally the contract would include `deployer()` and the frontend would read it from chain. I decided not to add that in V4 because it would require a V5 redeploy and full re-setup, including approval and test transactions. The limitation is documented in the `config.js` comments.

Tickets stay in the deployer's wallet rather than being transferred into the contract at deployment. The alternative was to make the contract hold the supply and sell from its own balance. I chose the deployer-holds model because ownership is clearer: the deployer's MetaMask always shows the real ticket inventory. It also uses ERC-20 allowance, the standard mechanism when one account authorises another address to spend tokens.

I used a manual `nonReentrant` guard instead of importing OpenZeppelin's `ReentrancyGuard`. OpenZeppelin would work, but importing it for one modifier adds dependency overhead and makes the contract footprint larger than this project needs. The manual implementation with warm-slot constants is well-understood and auditable in about 10 lines.

MetaMask would be more user-friendly than keystore authentication. I chose keystore auth because it matches the course tutorial pattern from Andy Legear's web3examples, creates a coherent create-wallet to buy to transfer loop, and demonstrates the key management mechanics that MetaMask hides from the user.

The token uses `decimals = 18` because that is the ERC-20 convention. This means fractional transfers are technically possible at the contract level. The frontend defends against that by making the doorman check `>= 1e18` and by making transfers always send exactly `1e18`. A production version would use `decimals = 0` or enforce whole-ticket amounts in the contract functions. I noted this as a known limitation after peer review.

The vendor is the deployer because this is a single-event system. In this model the deployer is the venue operator, receives tickets back through `transfer()`, and pulls revenue through `withdraw()`. A multi-event version would separate those roles, because organiser, venue, vendor, and contract owner do not always mean the same thing.

## 5. Transaction Evidence

Deployment [0x85786fc20431c6ac55e740b2a8b45d02fa99c0c6602e0516a2d86e96ee599916](https://sepolia.etherscan.io/tx/0x85786fc20431c6ac55e740b2a8b45d02fa99c0c6602e0516a2d86e96ee599916) proves the final V4 contract was deployed on Sepolia at `0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2`.

Approve setup [0xeef8cc3f327efad7e831b510014c94529fd53557d3a32ee1a1714ba29b05463f](https://sepolia.etherscan.io/tx/0xeef8cc3f327efad7e831b510014c94529fd53557d3a32ee1a1714ba29b05463f) proves the deployer granted the contract allowance to sell from the deployer's ticket inventory.

Buy via Remix [0x0f431f7d52cb1b2be1f95aa045e067dd9194677d69b88af582cae6b5722b5669](https://sepolia.etherscan.io/tx/0x0f431f7d52cb1b2be1f95aa045e067dd9194677d69b88af582cae6b5722b5669) proves `buyTicket()` worked from a contract interaction tool before the frontend was wired around it.

Buy via frontend [0x6023dd36578f0c0fddaebaed32d5d689d19fdc0fe26c9827b2a5f89e7f97f4d4](https://sepolia.etherscan.io/tx/0x6023dd36578f0c0fddaebaed32d5d689d19fdc0fe26c9827b2a5f89e7f97f4d4) proves the keystore unlock, transaction build, signing, and `buyTicket()` submission path works from the browser.

Transfer via frontend [0x7d55e4b6cd28101fd5a5fc506622885ea46e440c630c3610813ddb110456236e](https://sepolia.etherscan.io/tx/0x7d55e4b6cd28101fd5a5fc506622885ea46e440c630c3610813ddb110456236e) proves the browser can sign a standard ERC-20 `transfer()` that returns one full ticket to the vendor address.

Withdraw [0xd60ae875c55dc3d41331a1e1df99c234bcdc6bc842dacd9b599d05975e6f5ebd](https://sepolia.etherscan.io/tx/0xd60ae875c55dc3d41331a1e1df99c234bcdc6bc842dacd9b599d05975e6f5ebd) proves the deployer-only revenue withdrawal path works after ticket sales accumulate ETH in the contract.

Buy revert wrong value [0x76092608463a44c80744d96cf0e5b37ca7b2642164949ccf83002c084b8a496b](https://sepolia.etherscan.io/tx/0x76092608463a44c80744d96cf0e5b37ca7b2642164949ccf83002c084b8a496b) proves `buyTicket()` rejects payments that do not match the fixed ticket price.

Withdraw revert wrong caller [0xa289f3421cbaa958505f9a5390a7ac9f74540e2daeaa42996f1d2d262dd36c72](https://sepolia.etherscan.io/tx/0xa289f3421cbaa958505f9a5390a7ac9f74540e2daeaa42996f1d2d262dd36c72) proves non-deployer accounts cannot withdraw contract revenue.

Wallet top-up — the keystore buyer wallet [0x75F3d75BC22A7A06fa7825556665a7E69790E68a](https://sepolia.etherscan.io/address/0x75F3d75BC22A7A06fa7825556665a7E69790E68a) was funded by the deployer before testing via [0x06e09c8f8e2ca08746ddf987e362f5375313afbbe678e187a9a7a551be39c1cd](https://sepolia.etherscan.io/tx/0x06e09c8f8e2ca08746ddf987e362f5375313afbbe678e187a9a7a551be39c1cd). The deployer wallet was funded via Sepolia faucet prior to deployment, confirmed active by the deployment transaction above. The vendor/doorman role is fulfilled by the deployer in this single-event design.

## 6. Peer Review Response

The reviewer found three valid issues. NatSpec was absent, so I added it to the contract. The deployer allowance setup was undocumented, so I added it to NatSpec, the README, and this report. The buy and transfer pages were missing at review time, and I implemented them subsequently.

I declined a few changes because they would have required a V5 redeploy late in the work. The fractional ticket flaw is documented as a known limitation rather than fixed with `decimals = 0`, because the frontend already defends against fractional user actions. I made the same call on adding a `deployer()` getter: it would be cleaner, but not worth a redeploy and full re-setup. I also declined switching to OpenZeppelin ERC20 because manually writing the token was a deliberate choice for architectural understanding.

The review process taught me that the contract can be technically correct and still lose marks if the setup assumptions are not written down for the next person.

## 7. Known Limitations

- `decimals = 18` allows fractional transfers at contract level; frontend enforces whole-ticket operations.
- `DEPLOYER_ADDRESS` is hardcoded in frontend config; it needs manual update on redeploy.
- Ticket price is set to 0.000001 SETH for Sepolia testing economy.
- Venue sold count is inferred as total supply minus deployer balance; this is accurate for the single-event model with no peer-to-peer trading, but would need on-chain tracking for a multi-event system.
- There is no dedicated `returnTicket()` function; standard ERC-20 `transfer()` to the vendor address is used instead.
