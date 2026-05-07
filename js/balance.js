// Balance page logic — read-only, no signing, no keystore.
// Three role views selected by radio buttons: Attendee, Doorman, Venue.
// All chain reads use web3@1.10.4 via new Web3(RPC_URL) + web3.eth.Contract.

const web3     = new Web3(RPC_URL);
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

// ── Role switching ──────────────────────────────────────────

const panels = {
  attendee: document.getElementById('panel-attendee'),
  doorman:  document.getElementById('panel-doorman'),
  venue:    document.getElementById('panel-venue'),
};

document.getElementById('role-tabs').addEventListener('change', function (e) {
  const selected = e.target.value;
  Object.entries(panels).forEach(([role, el]) => {
    el.hidden = role !== selected;
  });
  document.querySelectorAll('.role-tabs label').forEach(label => {
    const radio = label.querySelector('input[type="radio"]');
    label.classList.toggle('active', radio.value === selected);
  });
});

// ── Attendee ────────────────────────────────────────────────

const attAddress = document.getElementById('att-address');
const btnAttCheck = document.getElementById('btn-att-check');
const attResult   = document.getElementById('att-result');

attAddress.addEventListener('input', () => {
  btnAttCheck.disabled = attAddress.value.trim() === '';
});

btnAttCheck.addEventListener('click', checkAttendee);

async function checkAttendee() {
  const addr = attAddress.value.trim();
  if (!web3.utils.isAddress(addr)) {
    showError('Invalid address — please enter a full 0x… Ethereum address.');
    return;
  }

  btnAttCheck.disabled = true;
  btnAttCheck.textContent = 'Checking…';
  attResult.hidden = true;

  try {
    const [ethWei, ticketRaw] = await Promise.all([
      web3.eth.getBalance(addr),
      contract.methods.balanceOf(addr).call(),
    ]);

    const ethDisplay    = parseFloat(web3.utils.fromWei(ethWei, 'ether')).toFixed(6);
    const ticketCount   = BigInt(ticketRaw) / BigInt('1000000000000000000');
    const ticketProse   = ticketCount === 1n
      ? 'You hold <strong>1 ticket</strong>.'
      : ticketCount > 1n
        ? `You hold <strong>${ticketCount} tickets</strong>.`
        : 'You hold <strong>no tickets</strong>.';

    attResult.innerHTML =
      `<p style="margin-top:16px;color:var(--text)">
         SETH balance: <strong>${ethDisplay} SETH</strong>
       </p>
       <p style="color:var(--text)">${ticketProse}</p>`;
    attResult.hidden = false;
  } catch (_) {
    showError('Sepolia RPC busy, try again in a moment.');
  } finally {
    btnAttCheck.disabled = false;
    btnAttCheck.textContent = 'Check';
  }
}

// ── Doorman ─────────────────────────────────────────────────

const doorAddress  = document.getElementById('door-address');
const btnDoorCheck = document.getElementById('btn-door-check');
const doorResult   = document.getElementById('door-result');

doorAddress.addEventListener('input', () => {
  btnDoorCheck.disabled = doorAddress.value.trim() === '';
});

btnDoorCheck.addEventListener('click', checkDoorman);

async function checkDoorman() {
  const addr = doorAddress.value.trim();
  if (!web3.utils.isAddress(addr)) {
    showError('Invalid address — please enter a full 0x… Ethereum address.');
    return;
  }

  btnDoorCheck.disabled = true;
  btnDoorCheck.textContent = 'Checking…';
  doorResult.hidden = true;

  try {
    const ticketRaw = await contract.methods.balanceOf(addr).call();
    const hasTicket = BigInt(ticketRaw) >= BigInt('1000000000000000000');
    const truncated = addr.slice(0, 6) + '…' + addr.slice(-4);

    doorResult.innerHTML = hasTicket
      ? `<div class="badge badge--pass">✓ HOLDS TICKET<br><span style="font-size:1rem;font-weight:500">${truncated}</span></div>`
      : `<div class="badge badge--fail">✗ NO TICKET<br><span style="font-size:1rem;font-weight:500">${truncated}</span></div>`;
    doorResult.hidden = false;
  } catch (_) {
    showError('Sepolia RPC busy, try again in a moment.');
  } finally {
    btnDoorCheck.disabled = false;
    btnDoorCheck.textContent = 'Verify';
  }
}

// ── Venue ───────────────────────────────────────────────────

const btnVenueRefresh = document.getElementById('btn-venue-refresh');
const venueResult     = document.getElementById('venue-result');

btnVenueRefresh.addEventListener('click', refreshVenue);

async function refreshVenue() {
  btnVenueRefresh.disabled = true;
  btnVenueRefresh.textContent = 'Loading…';
  venueResult.hidden = true;

  try {
    const [totalRaw, deployerRaw, contractWei] = await Promise.all([
      contract.methods.totalSupply().call(),
      contract.methods.balanceOf(DEPLOYER_ADDRESS).call(),
      web3.eth.getBalance(CONTRACT_ADDRESS),
    ]);

    const ONE = BigInt('1000000000000000000');
    const total     = BigInt(totalRaw)    / ONE;
    const remaining = BigInt(deployerRaw) / ONE;
    const sold      = total - remaining;
    const ethDisplay = parseFloat(web3.utils.fromWei(contractWei, 'ether')).toFixed(6);

    venueResult.innerHTML = `
      <div class="stats">
        <div class="stat">
          <div class="stat__label">Total Supply</div>
          <div class="stat__value">${total}</div>
        </div>
        <div class="stat">
          <div class="stat__label">Tickets Sold</div>
          <div class="stat__value">${sold}</div>
        </div>
        <div class="stat">
          <div class="stat__label">Remaining</div>
          <div class="stat__value">${remaining}</div>
        </div>
        <div class="stat">
          <div class="stat__label">Contract Balance</div>
          <div class="stat__value">${ethDisplay} SETH</div>
        </div>
      </div>`;
    venueResult.hidden = false;
  } catch (_) {
    showError('Sepolia RPC busy, try again in a moment.');
  } finally {
    btnVenueRefresh.disabled = false;
    btnVenueRefresh.textContent = 'Refresh';
  }
}
