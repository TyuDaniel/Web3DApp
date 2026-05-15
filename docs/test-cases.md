# Test Cases

Generated using AI assistance, then critically reviewed and expanded
with additional edge cases. Rows marked "not tested" were identified
as valid cases but fell outside the submission timeline.

---

## Contract

| ID | Page/Component | Test Description | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| CON-001 | Contract | Deploy with valid params | Valid name, symbol, initialSupply, ticketPrice | Contract deploys successfully, full supply minted to deployer, ticketPrice stored correctly | Deployment tx [0x85786fc...599916](https://sepolia.etherscan.io/tx/0x85786fc20431c6ac55e740b2a8b45d02fa99c0c6602e0516a2d86e96ee599916) confirms successful deploy, 100 tickets minted to deployer | ✅ |
| CON-002 | Contract | Deploy with ticketPrice = 0 | Valid name, symbol, initialSupply, ticketPrice = 0 | Contract deploys, ticketPrice stored as 0 | Verified by code inspection — constructor has no require on ticketPrice, value stored as-is | ✅ |
| CON-003 | Contract | buyTicket with exact correct value | Caller sends exactly ticketPrice wei after allowance set | Tx succeeds, caller receives 1 ticket, deployer balance decreases by 1, contract SETH increases by ticketPrice | Frontend buy tx [0x6023dd3...f97f4d4](https://sepolia.etherscan.io/tx/0x6023dd36578f0c0fddaebaed32d5d689d19fdc0fe26c9827b2a5f89e7f97f4d4) confirms ticket received | ✅ |
| CON-004 | Contract | buyTicket with too little value | Caller sends less than ticketPrice wei | Reverts with "TicketToken: incorrect payment" | Revert tx [0x7609260...8a496b](https://sepolia.etherscan.io/tx/0x76092608463a44c80744d96cf0e5b37ca7b2642164949ccf83002c084b8a496b) — Status: Fail, TicketToken: incorrect payment | ✅ |
| CON-005 | Contract | buyTicket with too much value | Caller sends more than ticketPrice wei | Reverts with "TicketToken: incorrect payment" | Verified by code inspection — require(msg.value == ticketPrice) rejects any deviation, not just underpayment | ✅ |
| CON-006 | Contract | buyTicket when no allowance set | Deployer has not called approve | Reverts with "TicketToken: no tickets available" | Verified by code inspection — allowance check fires before transfer | ✅ |
| CON-007 | Contract | buyTicket when allowance exhausted | Deployer allowance to contract is 0 | Reverts with "TicketToken: no tickets available" | Verified by code inspection — same allowance check as CON-006 | ✅ |
| CON-008 | Contract | Withdraw from deployer account | Deployer calls withdraw() after ticket sales | Tx succeeds, accumulated SETH sent to deployer | Withdraw tx [0xd60ae87...6f5ebd](https://sepolia.etherscan.io/tx/0xd60ae875c55dc3d41331a1e1df99c234bcdc6bc842dacd9b599d05975e6f5ebd) — 0.000005 SETH sent to deployer | ✅ |
| CON-009 | Contract | Withdraw from non-deployer account | Any account other than deployer calls withdraw() | Reverts with "TicketToken: only deployer" | Revert tx [0xa289f34...dd36c72](https://sepolia.etherscan.io/tx/0xa289f3421cbaa958505f9a5390a7ac9f74540e2daeaa42996f1d2d262dd36c72) — Status: Fail, TicketToken: only deployer | ✅ |
| CON-010 | Contract | Transfer between two accounts | Account with ticket calls transfer(recipient, 1e18) | Sender balance decreases by 1, recipient increases by 1 | Transfer tx [0x7d55e4b...456236e](https://sepolia.etherscan.io/tx/0x7d55e4b6cd28101fd5a5fc506622885ea46e440c630c3610813ddb110456236e) confirms ticket moved to deployer | ✅ |
| CON-011 | Contract | Transfer more than balance | Sender calls transfer() with amount > balance | Reverts with "ERC20: transfer amount exceeds balance" | Verified by code inspection — _transfer() require checks sender balance before updating | ✅ |
| CON-012 | Contract | balanceOf for address with no history | Call balanceOf() for address with no transfers | Returns 0 | Verified by code inspection — mapping default is 0 for uninitialised keys | ✅ |

---

## Create Wallet

| ID | Page/Component | Test Description | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| CW-001 | Create Wallet | Generate wallet produces valid address | Click Generate Wallet | Valid 0x Ethereum address displayed | Valid 0x address generated and displayed in address field | ✅ |
| CW-002 | Create Wallet | Generate wallet twice shows confirm dialog | Click Generate Wallet after wallet already shown | Browser confirm dialog appears before replacing | Not tested — out of scope for submission timeline | — |
| CW-003 | Create Wallet | Private key hidden on load | Generate a wallet | Private key field is type=password by default | Private key field confirmed type=password on load, not auto-revealed | ✅ |
| CW-004 | Create Wallet | Reveal toggle shows/hides private key | Click Show then Hide | Key becomes visible then hidden again | Not tested — out of scope for submission timeline | — |
| CW-005 | Create Wallet | Password under 12 chars keeps download disabled | Enter password shorter than 12 characters | Download button stays disabled | Not tested — out of scope for submission timeline | — |
| CW-006 | Create Wallet | Password exactly 12 chars enables download | Enter exactly 12 character password | Download button enables | Not tested — out of scope for submission timeline | — |
| CW-007 | Create Wallet | Download produces valid v3 keystore JSON | Generate wallet, enter password, click Download | Downloaded JSON is valid v3 keystore | Downloaded keystore verified — version 3, kdf=scrypt, cipher=aes-128-ctr, all required fields present | ✅ |
| CW-008 | Create Wallet | Wrong password on decrypt fails gracefully | Use keystore with wrong password on buy page | UI shows "incorrect password for this keystore" | Confirmed during buy page testing — BUY-001 covers this path | ✅ |

---

## Balance Page

| ID | Page/Component | Test Description | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| BAL-001 | Balance Page | Attendee view with valid address holding tickets | Enter valid address with ticket balance | Shows SETH balance and ticket count > 0 | Correct SETH balance and ticket count displayed for purchaser address | ✅ |
| BAL-002 | Balance Page | Attendee view with valid address with no tickets | Enter valid address with no tickets | Shows SETH balance and "no tickets" message | Showed 0.000000 SETH and "you hold no tickets" for empty address | ✅ |
| BAL-003 | Balance Page | Attendee view with malformed address | Enter malformed address and click Check | Friendly invalid address toast, no RPC call | Toast: "Invalid address — please enter a full 0x… Ethereum address." No RPC call fired | ✅ |
| BAL-004 | Balance Page | Attendee view with empty field | Leave address field empty | Check button stays disabled | Check button confirmed disabled on empty input | ✅ |
| BAL-005 | Balance Page | Doorman view — address holding ticket | Enter address with >= 1 ticket and click Verify | Green pass badge appears | Green ✓ HOLDS TICKET badge displayed with truncated address | ✅ |
| BAL-006 | Balance Page | Doorman view — address with no ticket | Enter address with 0 tickets and click Verify | Red fail badge appears | Red ✗ NO TICKET badge displayed with truncated address | ✅ |
| BAL-007 | Balance Page | Doorman badge shows truncated address | Verify any valid address in doorman view | Badge shows 0x1234...abcd format | Badge showed 0x3144...7FfB for purchaser address | ✅ |
| BAL-008 | Balance Page | Venue view shows correct totalSupply | Open venue view and click Refresh | Total Supply matches contract totalSupply / 1e18 | Displayed 100 — matches initialSupply=100 from constructor | ✅ |
| BAL-009 | Balance Page | Venue sold count = totalSupply minus deployer balance | Open venue view and click Refresh | Tickets Sold = Total Supply minus Remaining | Sold count correctly reflected test purchases made during development | ✅ |
| BAL-010 | Balance Page | Venue contract SETH balance after a buy | Buy a ticket then refresh venue view | Contract Balance increases by ticketPrice | Not tested in isolation — withdraw was called before this was checked separately | — |
| BAL-011 | Balance Page | RPC failure shows friendly error | Set RPC_URL to bad URL and trigger balance read | Friendly error toast, no raw stack trace | Tested by temporarily setting RPC_URL to invalid URL — toast: "Sepolia RPC busy, try again in a moment." | ✅ |

---

## Buy Page

| ID | Page/Component | Test Description | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| BUY-001 | Buy Page | Upload valid keystore, wrong password | Select valid keystore, enter wrong password, click Unlock | UI shows "incorrect password for this keystore" | Toast: "incorrect password for this keystore" — no raw error | ✅ |
| BUY-002 | Buy Page | Upload valid keystore, correct password | Select valid keystore, correct password, click Unlock | Wallet panel appears with address, balance, ticket count, price | Wallet panel appeared with all 4 stats correctly populated | ✅ |
| BUY-003 | Buy Page | Upload malformed JSON file | Select malformed JSON file and click Unlock | UI shows "this doesn't look like a valid keystore file" | Not tested in isolation — covered by EC-001 edge case | — |
| BUY-004 | Buy Page | Wallet panel shows correct stats | Unlock valid keystore | Address, balance, ticket count, price all match chain state | All stats matched on-chain values when checked against Etherscan | ✅ |
| BUY-005 | Buy Page | Buy with sufficient SETH | Unlock funded wallet and click Buy Ticket | Tx confirms, wallet receives 1 ticket | Frontend buy tx [0x6023dd3...f97f4d4](https://sepolia.etherscan.io/tx/0x6023dd36578f0c0fddaebaed32d5d689d19fdc0fe26c9827b2a5f89e7f97f4d4) confirmed | ✅ |
| BUY-006 | Buy Page | Buy with zero SETH balance | Unlock wallet with 0 SETH, click Buy Ticket | Friendly insufficient funds message with required and actual SETH | Error shown when wallet 0x75F3 had 0 balance — "you need at least X SETH" | ✅ |
| BUY-007 | Buy Page | State machine cycles correctly | Click Buy Ticket with valid funded wallet | State panel moves estimating → pending → success | State transitions observed during BUY-005 test | ✅ |
| BUY-008 | Buy Page | Etherscan link appears on success | Complete successful buy | Clickable Sepolia Etherscan link appears | Link appeared pointing to correct tx hash after BUY-005 | ✅ |
| BUY-009 | Buy Page | Pending timer counts up | Start buy and observe pending state | Elapsed seconds increase while waiting | Timer observed counting up during BUY-005 pending phase | ✅ |
| BUY-010 | Buy Page | Refresh during pending triggers warning | Start buy and refresh while pending | Browser warns about leaving during pending tx | Not tested — difficult to time reliably; beforeunload handler confirmed in code | — |
| BUY-011 | Buy Page | Balances refresh after successful buy | Complete successful buy | SETH balance and ticket count update after receipt | Balances updated correctly after BUY-005 completed | ✅ |

---

## Transfer Page

| ID | Page/Component | Test Description | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| TRF-001 | Transfer Page | Unlock with correct keystore and password | Select valid keystore, correct password, click Unlock | Wallet panel appears with address, balance, tickets, vendor address | Wallet panel appeared with all stats including truncated vendor address | ✅ |
| TRF-002 | Transfer Page | Unlock with wrong password | Select valid keystore, wrong password, click Unlock | UI shows "incorrect password for this keystore" | Not tested on transfer page specifically — same decrypt path as BUY-001 | — |
| TRF-003 | Transfer Page | Transfer button disabled when tickets = 0 | Unlock wallet with 0 tickets | Transfer button disabled, reason text shown | Button confirmed disabled with reason text when ticket count was 0 | ✅ |
| TRF-004 | Transfer Page | Transfer button enabled when tickets >= 1 | Unlock wallet with at least 1 ticket | Transfer button enables | Button enabled after buying a ticket via buy page first | ✅ |
| TRF-005 | Transfer Page | Transfer sends to DEPLOYER_ADDRESS | Inspect vendor address before transfer | Vendor address fixed from config, no editable field | Vendor address shown as truncated deployer address, no input field present | ✅ |
| TRF-006 | Transfer Page | Successful transfer — buyer tickets drop by 1 | Unlock wallet with ticket, click Transfer | Holder ticket count decreases by 1 | Transfer tx [0x7d55e4b...456236e](https://sepolia.etherscan.io/tx/0x7d55e4b6cd28101fd5a5fc506622885ea46e440c630c3610813ddb110456236e) confirms — buyer balance dropped to 0 | ✅ |
| TRF-007 | Transfer Page | Successful transfer — deployer tickets increase by 1 | Record deployer balance, transfer ticket, check deployer | Deployer ticket balance increases by 1 | Confirmed via balanceOf read on Etherscan after transfer tx | ✅ |
| TRF-008 | Transfer Page | Transfer with 0 tickets errors even if button bypassed | Force transfer handler via console with 0 tickets | UI shows "you don't hold a ticket to transfer" | Not tested via console bypass — defensive check confirmed in code before signing | — |
| TRF-009 | Transfer Page | Etherscan link appears on success | Complete successful transfer | Clickable Etherscan link appears | Link appeared after TRF-006 completed | ✅ |

---

## Edge Cases Added on Review

The following cases were identified after reviewing the AI-generated
table. They cover scenarios the initial generation missed.

| ID | Page/Component | Test Description | Input | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| EC-001 | Buy Page | Upload valid JSON that is not a keystore | Select valid JSON file lacking keystore fields (version, crypto, address) | UI shows "this doesn't look like a valid keystore file" — isKeystoreLike() guard catches it before decrypt | Not tested — identified as gap during review | — |
| EC-002 | Buy Page | Switch keystore file mid-session without refreshing | Unlock wallet A then select wallet B file without refreshing | Wallet panel hides, state resets to idle, previous unlock cleared — no stale account in memory | Not tested — identified as gap during review | — |
| EC-003 | Buy Page | Wallet has exact ticket price but insufficient gas | Unlock wallet with SETH = ticketPrice but not enough for gas | Friendly insufficient funds error showing required vs actual SETH | Not tested — identified as gap during review | — |
| EC-004 | Contract | buyTicket after allowance exhausted mid-sale | All approved tickets sold, then attempt another buy with correct value | Reverts with "TicketToken: no tickets available" | Verified by code inspection — same allowance check as CON-006/CON-007 | ✅ |
| EC-005 | Balance Page | Venue view before any tickets are sold | Open venue view immediately after deployment and approve | Sold = 0, Remaining = 100, Contract Balance = 0.000000 SETH | Not tested in isolation — venue view checked after sales had already occurred | — |
| EC-006 | Transfer Page | Force transfer with 0 tickets via console | Call transfer handler directly while unlocked wallet has 0 tickets | "you don't hold a ticket to transfer" — code-level check fires before signing | Not tested — defensive check confirmed in transfer.js source | — |