// Transfer ticket page logic — decrypts keystore locally and sends one ERC-20 transfer.

const web3 = new Web3(RPC_URL);
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
const ONE_TICKET = BigInt('1000000000000000000');

const state = {
  name: 'idle',
  detail: 'Upload your keystore to begin.',
};

let selectedKeystoreFile = null;
let latestBalanceWei = '0';
let latestTicketRaw = '0';
let pendingStartedAt = null;
let pendingTimer = null;
let refreshingAfterSuccess = false;

// Security trade-off for this coursework UI: the decrypted account remains in
// memory while the page is open so the user can transfer without repeating the
// slow scrypt decrypt step. A stricter design would decrypt again per transaction.
let unlockedAccount = null;

const els = {
  keystoreFile: document.getElementById('keystore-file'),
  password: document.getElementById('keystore-password'),
  unlockButton: document.getElementById('btn-unlock'),
  transferButton: document.getElementById('btn-transfer'),
  disabledReason: document.getElementById('transfer-disabled-reason'),
  walletPanel: document.getElementById('wallet-panel'),
  address: document.getElementById('holder-address'),
  eth: document.getElementById('holder-eth'),
  tickets: document.getElementById('holder-tickets'),
  vendor: document.getElementById('vendor-address'),
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
  const hasTicket = getLatestTicketCount() >= 1n;
  const canUnlock = selectedKeystoreFile !== null && els.password.value.length > 0 && !unlockDisabled;
  const canTransfer = unlockedAccount !== null
    && hasTicket
    && !refreshingAfterSuccess
    && ['unlocked', 'success', 'error'].includes(state.name);

  els.unlockButton.disabled = !canUnlock;
  els.transferButton.disabled = !canTransfer;
  els.disabledReason.hidden = unlockedAccount === null || hasTicket;
  els.disabledReason.textContent = hasTicket ? '' : "You don't hold a ticket to transfer.";
}

function formatEth(wei, fractionDigits = 6) {
  return Number(web3.utils.fromWei(String(wei), 'ether')).toFixed(fractionDigits);
}

function getLatestTicketCount() {
  return BigInt(latestTicketRaw) / ONE_TICKET;
}

function truncateAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  const [ethWei, ticketRaw] = await Promise.all([
    web3.eth.getBalance(unlockedAccount.address),
    contract.methods.balanceOf(unlockedAccount.address).call(),
  ]);

  latestBalanceWei = ethWei;
  latestTicketRaw = ticketRaw;

  els.address.textContent = unlockedAccount.address;
  els.eth.textContent = `${formatEth(ethWei)} SETH`;
  els.tickets.textContent = getLatestTicketCount().toString();
  els.vendor.textContent = truncateAddress(DEPLOYER_ADDRESS);
  els.walletPanel.hidden = false;
  renderControls();
}

function mapTransferError(error, context = {}) {
  const message = String(
    error && (error.message || error.reason || error.data || error)
  );

  if (context.phase === 'parse-keystore') {
    return "this doesn't look like a valid keystore";
  }

  if (context.phase === 'decrypt') {
    return 'incorrect password for this keystore';
  }

  if (message.includes('ERC20: transfer amount exceeds balance')) {
    return "you don't hold a ticket to transfer";
  }

  if (context.phase === 'balance-check') {
    return `you need SETH to cover the transaction fee. your balance is ${context.balanceEth}.`;
  }

  if (context.phase === 'broadcast') {
    return 'transaction may or may not have been sent. check etherscan for your address before retrying.';
  }

  console.error('Unhandled transfer ticket error:', error);
  return 'unexpected error. check the browser console for details';
}

async function unlockWallet() {
  if (!selectedKeystoreFile) {
    showError("this doesn't look like a valid keystore");
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
    const message = mapTransferError(error, { phase: 'parse-keystore' });
    setState('error', message);
    showError(message);
    return;
  }

  try {
    unlockedAccount = web3.eth.accounts.decrypt(keystore, els.password.value);
  } catch (error) {
    unlockedAccount = null;
    els.walletPanel.hidden = true;
    const message = mapTransferError(error, { phase: 'decrypt' });
    setState('error', message);
    showError(message);
    return;
  }

  try {
    await refreshWalletState();
    setState('unlocked', 'Wallet unlocked. Transfer is available if this wallet holds a ticket.');
    showSuccess('Wallet unlocked.');
  } catch (error) {
    console.error('Failed to refresh unlocked wallet:', error);
    setState('error', 'could not load wallet balances from Sepolia. please try again.');
    showError('could not load wallet balances from Sepolia. please try again.');
  }
}

async function transferTicket() {
  if (!unlockedAccount) {
    showError('unlock your keystore before transferring a ticket');
    setState('error', 'unlock your keystore before transferring a ticket');
    return;
  }

  if (getLatestTicketCount() < 1n) {
    const message = "you don't hold a ticket to transfer";
    showError(message);
    setState('error', message);
    return;
  }

  els.receiptPanel.hidden = true;
  setState('estimating', 'Estimating gas before signing...');

  const amount = ONE_TICKET.toString();
  const data = contract.methods.transfer(DEPLOYER_ADDRESS, amount).encodeABI();
  let gas;
  let gasPrice;

  try {
    [gas, gasPrice] = await Promise.all([
      contract.methods.transfer(DEPLOYER_ADDRESS, amount).estimateGas({
        from: unlockedAccount.address,
      }),
      web3.eth.getGasPrice(),
    ]);
  } catch (error) {
    const message = mapTransferError(error, { phase: 'estimate' });
    setState('error', message);
    showError(message);
    return;
  }

  const requiredWei = BigInt(gas) * BigInt(gasPrice);
  if (BigInt(latestBalanceWei) < requiredWei) {
    const message = mapTransferError(null, {
      phase: 'balance-check',
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
      data,
      gas,
      gasPrice,
      nonce,
      chainId: CHAIN_ID,
    });
  } catch (error) {
    console.error('Failed to sign transfer ticket transaction:', error);
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
    const message = mapTransferError(error, { phase: 'broadcast' });
    setState('error', message);
    showError(message);
    return;
  }

  stopPendingTimer();
  renderReceipt(receipt.transactionHash);
  refreshingAfterSuccess = true;
  setState('success', 'Transaction confirmed. Refreshing wallet balances...');
  showSuccess('Ticket transferred.');

  try {
    await refreshWalletState();
    refreshingAfterSuccess = false;
    setState('success', 'Transaction confirmed and balances refreshed.');
  } catch (error) {
    refreshingAfterSuccess = false;
    console.error('Ticket transferred, but balance refresh failed:', error);
    setState('success', 'Transaction confirmed, but balances did not refresh. Reload the page to check current state.');
    showError('ticket transferred, but balances did not refresh');
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
  latestTicketRaw = '0';
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
els.transferButton.addEventListener('click', transferTicket);
window.addEventListener('beforeunload', handleBeforeUnload);

renderState();
renderControls();
