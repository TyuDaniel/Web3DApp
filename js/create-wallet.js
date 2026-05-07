// Create wallet page logic

const web3 = new Web3();
let wallet = null;

function generateWallet() {
  if (wallet !== null && !confirm('This will overwrite your existing wallet. Continue?')) {
    return;
  }

  wallet = web3.eth.accounts.create();

  document.getElementById('out-address').value = wallet.address;
  document.getElementById('out-privkey').value = wallet.privateKey;
  document.getElementById('out-privkey').type = 'password';
  document.getElementById('btn-reveal').textContent = 'Show';
  document.getElementById('inp-password').value = '';
  document.getElementById('btn-download').disabled = true;
  document.getElementById('wallet-output').removeAttribute('hidden');
}

function toggleReveal() {
  const field = document.getElementById('out-privkey');
  const btn = document.getElementById('btn-reveal');
  if (field.type === 'password') {
    field.type = 'text';
    btn.textContent = 'Hide';
  } else {
    field.type = 'password';
    btn.textContent = 'Show';
  }
}

function handlePassword() {
  const len = document.getElementById('inp-password').value.length;
  document.getElementById('btn-download').disabled = len < 12;
}

function downloadKeystore() {
  const password = document.getElementById('inp-password').value;
  if (!wallet || password.length < 12) return;

  const keystore = web3.eth.accounts.encrypt(wallet.privateKey, password);
  const filename = `wallet-${wallet.address.slice(0, 8)}-${Date.now()}.json`;

  try {
    const blob = new Blob([JSON.stringify(keystore)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Keystore downloaded.');
  } catch (e) {
    showError('Download failed — your browser may have blocked it.');
  }
}

document.getElementById('btn-generate').addEventListener('click', generateWallet);
document.getElementById('btn-reveal').addEventListener('click', toggleReveal);
document.getElementById('inp-password').addEventListener('input', handlePassword);
document.getElementById('btn-download').addEventListener('click', downloadKeystore);
