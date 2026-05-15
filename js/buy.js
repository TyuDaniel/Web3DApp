// Buy ticket page logic — decrypts keystore locally and sends one payable tx.

const web3 = new Web3(RPC_URL);
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
const ONE_TICKET = BigInt('1000000000000000000');

const state = {
  name: 'idle',
  detail: 'Upload your keystore to begin.',
};

let selectedKeystoreFile = null;
let latestBalanceWei = '0';
let latestTicketPriceWei = '0';
let pendingStartedAt = null;
let pendingTimer = null;
let refreshingAfterSuccess = false;

// Security trade-off for this coursework UI: the decrypted account remains in
// memory while the page is open so the user can buy without repeating the slow
// scrypt decrypt step. A stricter design would decrypt again per transaction.
let unlockedAccount = null;

const els = {
  keystoreFile: document.getElementById('keystore-file'),
  password: document.getElementById('keystore-password'),
  unlockButton: document.getElementById('btn-unlock'),
  buyButton: document.getElementById('btn-buy'),
  walletPanel: document.getElementById('wallet-panel'),
  address: document.getElementById('buyer-address'),
  eth: document.getElementById('buyer-eth'),
  tickets: document.getElementById('buyer-tickets'),
  ticketPrice: document.getElementById('ticket-price'),
  stateLabel: document.getElementById('state-label'),
  stateSpinner: document.getElementById('state-spinner'),
  stateDetail: document.getElementById('state-detail'),
  receiptPanel: document.getElementById('receipt-panel'),
  etherscanLink: document.getElementById('etherscan-link'),
};

function setState(name, detail) {
  state.name = name;
  state.detail = detail;
  renderState();
  renderControls();
}

function renderState() {
  const busyStates = ['unlocking', 'estimating', 'pending'];
  els.stateLabel.textContent = state.name;
  els.stateDetail.textContent = state.detail;
  els.stateSpinner.hidden = !busyStates.includes(state.name);
}

function renderControls() {
  const unlockDisabled = ['unlocking', 'estimating', 'pending'].includes(state.name);
  const canUnlock = selectedKeystoreFile !== null && els.password.value.length > 0 && !unlockDisabled;
  const canBuy = unlockedAccount !== null
    && !refreshingAfterSuccess
    && ['unlocked', 'success', 'error'].includes(state.name);

  els.unlockButton.disabled = !canUnlock;
  els.buyButton.disabled = !canBuy;
}

function formatEth(wei, fractionDigits = 6) {
  return Number(web3.utils.fromWei(String(wei), 'ether')).toFixed(fractionDigits);
}

function formatTicketCount(raw) {
  return (BigInt(raw) / ONE_TICKET).toString();
}

function readKeystoreFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function isKeystoreLike(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.address === 'string'
    && value.crypto !== undefined
    && (value.version === 3 || value.version === '3');
}

async function refreshWalletState() {
  if (!unlockedAccount) return;

  const [ethWei, ticketRaw, priceWei] = await Promise.all([
    web3.eth.getBalance(unlockedAccount.address),
    contract.methods.balanceOf(unlockedAccount.address).call(),
    contract.methods.ticketPrice().call(),
  ]);

  latestBalanceWei = ethWei;
  latestTicketPriceWei = priceWei;

  els.address.textContent = unlockedAccount.address;
  els.eth.textContent = `${formatEth(ethWei)} SETH`;
  els.tickets.textContent = formatTicketCount(ticketRaw);
  els.ticketPrice.textContent = `${formatEth(priceWei)} SETH`;
  els.walletPanel.hidden = false;
}

function mapBuyError(error, context = {}) {
  const message = String(
    error && (error.message || error.reason || error.data || error)
  );

  if (context.phase === 'parse-keystore') {
    return "this doesn't look like a valid keystore file";
  }

  if (context.phase === 'decrypt') {
    return 'incorrect password for this keystore';
  }

  if (message.includes('TicketToken: incorrect payment')) {
    return 'the ticket price changed - please refresh and try again';
  }

  if (message.includes('TicketToken: no tickets available')) {
    return 'the event is sold out';
  }

  if (message.includes('TicketToken: reentrant call')) {
    return 'transaction rejected by safety check - please try again';
  }

  if (context.phase === 'balance-check') {
    return `you need at least ${context.requiredEth} SETH (price + gas estimate). your balance is ${context.balanceEth}.`;
  }

  if (context.phase === 'broadcast') {
    return 'transaction may or may not have been sent. check etherscan for your address before retrying.';
  }

  console.error('Unhandled buy ticket error:', error);
  return `unexpected ${context.phase || 'buy'} error. check the browser console for details.`;
}

async function unlockWallet() {
  if (!selectedKeystoreFile) {
    showError("this doesn't look like a valid keystore file");
    return;
  }

  setState('unlocking', 'Decrypting keystore locally...');
  els.receiptPanel.hidden = true;

  let keystore;
  try {
    keystore = await readKeystoreFile(selectedKeystoreFile);
    if (!isKeystoreLike(keystore)) {
      throw new Error('invalid keystore shape');
    }
  } catch (error) {
    const message = mapBuyError(error, { phase: 'parse-keystore' });
    setState('error', message);
    showError(message);
    return;
  }

  try {
    unlockedAccount = web3.eth.accounts.decrypt(keystore, els.password.value);
  } catch (error) {
    unlockedAccount = null;
    els.walletPanel.hidden = true;
    const message = mapBuyError(error, { phase: 'decrypt' });
    setState('error', message);
    showError(message);
    return;
  }

  try {
    await refreshWalletState();
    setState('unlocked', 'Wallet unlocked. Review the price, then buy your ticket.');
    showSuccess('Wallet unlocked.');
  } catch (error) {
    console.error('Failed to refresh unlocked wallet:', error);
    setState('error', 'could not load wallet balances from Sepolia. please try again.');
    showError('could not load wallet balances from Sepolia. please try again.');
  }
}

async function buyTicket() {
  if (!unlockedAccount) {
    showError('unlock your keystore before buying a ticket');
    setState('error', 'unlock your keystore before buying a ticket');
    return;
  }

  els.receiptPanel.hidden = true;
  setState('estimating', 'Estimating gas before signing...');

  const data = contract.methods.buyTicket().encodeABI();
  let gas;
  let gasPrice;

  try {
    [gas, gasPrice] = await Promise.all([
      contract.methods.buyTicket().estimateGas({
        from: unlockedAccount.address,
        value: latestTicketPriceWei,
      }),
      web3.eth.getGasPrice(),
    ]);
  } catch (error) {
    const message = mapBuyError(error, { phase: 'estimate' });
    setState('error', message);
    showError(message);
    return;
  }

  const requiredWei = BigInt(latestTicketPriceWei) + BigInt(gas) * BigInt(gasPrice);
  if (BigInt(latestBalanceWei) < requiredWei) {
    const message = mapBuyError(null, {
      phase: 'balance-check',
      requiredEth: formatEth(requiredWei),
      balanceEth: formatEth(latestBalanceWei),
    });
    setState('error', message);
    showError(message);
    return;
  }

  let signed;
  try {
    const nonce = await web3.eth.getTransactionCount(unlockedAccount.address, 'pending');
    signed = await unlockedAccount.signTransaction({
      from: unlockedAccount.address,
      to: CONTRACT_ADDRESS,
      value: latestTicketPriceWei,
      data,
      gas,
      gasPrice,
      nonce,
      chainId: CHAIN_ID,
    });
  } catch (error) {
    console.error('Failed to sign buy ticket transaction:', error);
    setState('error', 'could not sign the transaction. check the browser console for details.');
    showError('could not sign the transaction.');
    return;
  }

  startPendingTimer();

  let receipt;
  try {
    receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
  } catch (error) {
    stopPendingTimer();
    const message = mapBuyError(error, { phase: 'broadcast' });
    setState('error', message);
    showError(message);
    return;
  }

  stopPendingTimer();
  renderReceipt(receipt.transactionHash);
  refreshingAfterSuccess = true;
  setState('success', 'Transaction confirmed. Refreshing wallet balances...');
  showSuccess('Ticket purchased.');

  try {
    await refreshWalletState();
    refreshingAfterSuccess = false;
    setState('success', 'Transaction confirmed and balances refreshed.');
  } catch (error) {
    refreshingAfterSuccess = false;
    console.error('Ticket bought, but balance refresh failed:', error);
    setState('success', 'Transaction confirmed, but balances did not refresh. Reload the page to check current state.');
    showError('ticket bought, but balances did not refresh');
  }
}

function startPendingTimer() {
  pendingStartedAt = Date.now();
  setState('pending', 'Transaction broadcast. Waiting for a block: 0 seconds elapsed.');
  pendingTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - pendingStartedAt) / 1000);
    setState('pending', `Transaction broadcast. Waiting for a block: ${elapsed} seconds elapsed.`);
  }, 1000);
}

function stopPendingTimer() {
  if (pendingTimer !== null) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
  pendingStartedAt = null;
}

function renderReceipt(txHash) {
  const url = `https://sepolia.etherscan.io/tx/${txHash}`;
  els.etherscanLink.href = url;
  els.etherscanLink.textContent = `View transaction ${txHash.slice(0, 10)}...${txHash.slice(-8)} on Etherscan`;
  els.receiptPanel.hidden = false;
}

function handleKeystoreChange() {
  selectedKeystoreFile = els.keystoreFile.files[0] || null;
  unlockedAccount = null;
  els.walletPanel.hidden = true;
  els.receiptPanel.hidden = true;
  setState('idle', selectedKeystoreFile ? 'Enter the keystore password to unlock.' : 'Upload your keystore to begin.');
}

function handleBeforeUnload(event) {
  if (state.name !== 'pending') return;

  event.preventDefault();
  event.returnValue = 'transaction pending - leaving may lose track of it';
}

els.keystoreFile.addEventListener('change', handleKeystoreChange);
els.password.addEventListener('input', renderControls);
els.unlockButton.addEventListener('click', unlockWallet);
els.buyButton.addEventListener('click', buyTicket);
window.addEventListener('beforeunload', handleBeforeUnload);

renderState();
renderControls();
