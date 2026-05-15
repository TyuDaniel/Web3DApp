# Web3 Ticketing DApp

A small ticketing system built on Ethereum Sepolia testnet as part of 
a blockchain module at the University of Limerick. Users can create a 
wallet, buy a ticket using SETH, and transfer it back to the vendor. 
Everything runs client-side — no server, no framework, no MetaMask 
required.

## Pages

`Create wallet` lets you make a wallet and download the keystore JSON.

`Check balance` has three views:
- Attendee: shows your ticket balance
- Doorman: shows a yes/no badge for whether someone holds a ticket
- Venue: shows total supply, sold, and remaining tickets

`Buy ticket` lets you upload your keystore, enter the password, and 
buy 1 ticket with SETH.

`Transfer ticket` lets you upload your keystore and send your ticket 
back to the vendor.

## How to run

Open the folder in VS Code. Right click `index.html` and choose 
`Open with Live Server`. The app runs at:

```text
http://localhost:5500
```

## Before you buy or transfer

You need a keystore JSON first. Make one on the Create wallet page, 
download it, and keep the password safe.

The wallet also needs a small amount of Sepolia ETH for gas and the 
ticket payment. You can get some here:
- https://sepoliafaucet.com
- https://faucet.sepolia.dev

## Contract

| | |
|--|--|
| Network | Ethereum Sepolia testnet |
| Address | 0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2 |
| Etherscan | https://sepolia.etherscan.io/address/0x705D6c204a755e51b517bBA9124e3F23Dc9F88C2 |
| Ticket price | 0.000001 SETH (set low for testing) |

## Important deploy note

After deploying the contract the deployer must call:

```text
approve(contractAddress, fullSupply)
```

If this step is skipped, `buyTicket` will always fail with 
`no tickets available` even when tickets exist. Easy to miss.

## Known limitations

- Ticket price is set to 0.000001 SETH for Sepolia testing economy. 
  A production version would use a realistic price.
- The deployer address is hardcoded in `js/config.js` rather than 
  read from the contract. If you redeploy to a new address, update 
  both `CONTRACT_ADDRESS` and `DEPLOYER_ADDRESS` in that file.
- ERC-20 technically allows fractional token transfers. The frontend 
  enforces whole-ticket operations but the contract itself does not 
  restrict it.


- `docs/report.md` - project report and Generative AI statement
- `docs/deployments.md` - Sepolia contract, wallet, and transaction evidence
- `docs/test-cases.md` - manual and code-inspection test cases
- `docs/ai-chatlogs/` - AI development and review logs
