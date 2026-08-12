// assets/app.js
// Gold Tracker — Main application logic
// Vanilla JS, ES modules, no build step.

import { getCurrentGoldPrices, diffAgainstLastVisit } from './gold-price.js';

// ─── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'goldHoldings';
const KARAT_LABELS = { 24: 'K24', 22: 'K22', 21: 'K21', 18: 'K18' };

// ─── State ───────────────────────────────────────────────────────────────────
let priceData   = null;   // from getCurrentGoldPrices()
let priceError  = false;
let holdings    = [];     // [{id, karat, grams, buyPrice, boughtAt}]
let editingId   = null;   // null = adding new

// ─── Formatting ──────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtEGP = (n) => `${fmt(n)} EGP`;

const fmtPct = (n) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
function loadHoldings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHoldings(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─── Portfolio computation ────────────────────────────────────────────────────
function computeHolding(h, priceData) {
  const karatKey = `k${h.karat}`;
  const price    = priceData?.karats?.[karatKey];

  const invested     = h.grams * h.buyPrice;
  const currentValue = price ? h.grams * price.sellPerGram : null;
  const pnl          = currentValue !== null ? currentValue - invested : null;
  const pnlPct       = (pnl !== null && invested > 0) ? (pnl / invested) * 100 : null;
  const roi          = pnlPct;

  return { ...h, invested, currentValue, pnl, pnlPct, roi, sellPerGram: price?.sellPerGram ?? null };
}

function computeTotals(computed) {
  const totalInvested     = computed.reduce((s, h) => s + h.invested, 0);
  const totalCurrentValue = computed.filter(h => h.currentValue !== null)
                                    .reduce((s, h) => s + h.currentValue, 0);
  const totalPnl          = computed.filter(h => h.pnl !== null)
                                    .reduce((s, h) => s + h.pnl, 0);
  const totalPnlPct       = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const hasLiveValues     = computed.some(h => h.currentValue !== null);

  return { totalInvested, totalCurrentValue, totalPnl, totalPnlPct, hasLiveValues };
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function pnlClass(val) {
  if (val === null || val === undefined) return 'flat';
  if (val > 0) return 'gain';
  if (val < 0) return 'loss';
  return 'flat';
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function showSkeleton() {
  const grid = $('#holdings-grid');
  grid.innerHTML = [1,2].map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-line" style="width:60%;margin-bottom:14px"></div>
      <div class="skeleton skeleton-line" style="width:40%"></div>
      <div class="skeleton skeleton-line" style="width:80%"></div>
      <div class="skeleton skeleton-line" style="width:55%;margin-top:14px"></div>
    </div>
  `).join('');
}

// ─── Render: Summary ─────────────────────────────────────────────────────────
function renderSummary(computed) {
  const totals = computeTotals(computed);
  const cls    = pnlClass(totals.totalPnl);

  $('#total-invested').textContent  = fmtEGP(totals.totalInvested);
  $('#total-value').textContent     = totals.hasLiveValues
    ? fmtEGP(totals.totalCurrentValue)
    : '—';
  $('#total-pnl').textContent       = totals.hasLiveValues
    ? fmtEGP(totals.totalPnl)
    : '—';
  $('#total-pnl').className         = `summary-value font-mono ${cls}`;
  $('#total-pnl-pct').textContent   = totals.hasLiveValues
    ? fmtPct(totals.totalPnlPct)
    : '';
  $('#total-pnl-pct').className     = `summary-sub ${cls}`;
}

// ─── Render: Since Last Visit ─────────────────────────────────────────────────
function renderSinceLastVisit() {
  const section = $('#since-visit-section');
  const list    = $('#since-visit-list');

  if (!priceData || holdings.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  const uniqueKarats = [...new Set(holdings.map(h => h.karat))].sort((a,b) => b-a);
  const cards = [];

  for (const karat of uniqueKarats) {
    const karatKey = `k${karat}`;
    if (!priceData.karats[karatKey]) continue;

    const diff = diffAgainstLastVisit(priceData, karat);

    if (!diff) {
      // First visit for this karat
      cards.push(`
        <div class="first-visit-note">
          K${karat} — First visit recorded. Changes will show next time you open the app.
        </div>
      `);
    } else {
      const cls = pnlClass(diff.change);
      const sign = diff.change >= 0 ? '+' : '';
      cards.push(`
        <div class="since-visit-card">
          <span class="visit-karat">K${karat}</span>
          <div class="visit-prices">
            <span class="text-secondary font-mono">${fmtEGP(diff.previousPrice)}</span>
            <span class="visit-arrow">→</span>
            <span class="font-mono">${fmtEGP(diff.currentPrice)}</span>
          </div>
          <span class="visit-change ${cls}">
            ${sign}${fmtEGP(diff.change)} &nbsp; ${sign}${diff.changePercent.toFixed(2)}%
          </span>
          <div class="visit-timestamp">
            Last checked: ${fmtDateTime(diff.previousTimestamp)}
          </div>
        </div>
      `);
    }
  }

  list.innerHTML = cards.join('');
}

// ─── Render: Holdings Grid ────────────────────────────────────────────────────
function renderHoldings() {
  const grid  = $('#holdings-grid');
  const count = $('#holdings-count');

  if (holdings.length === 0) {
    count.textContent = '';
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🪙</div>
        <div class="empty-title">No holdings yet</div>
        <div class="empty-body">
          Add your first gold holding to start tracking its current value and profit.
        </div>
        <button class="btn btn-primary" style="max-width:200px;margin:0 auto" onclick="openModal()">
          ＋ Add Holding
        </button>
      </div>
    `;
    return;
  }

  count.textContent = `${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`;

  const computed = holdings.map(h => computeHolding(h, priceData));
  grid.innerHTML  = computed.map(h => holdingCardHTML(h)).join('');
  renderSummary(computed);
}

function holdingCardHTML(h) {
  const pnlCls = pnlClass(h.pnl);
  const sign   = h.pnl !== null && h.pnl >= 0 ? '+' : '';

  const metricsHTML = h.currentValue !== null ? `
    <div class="holding-metrics">
      <div class="metric">
        <div class="metric-label">Buy Price</div>
        <div class="metric-value font-mono">${fmtEGP(h.buyPrice)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Current Price</div>
        <div class="metric-value font-mono">${fmtEGP(h.sellPerGram)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Invested</div>
        <div class="metric-value font-mono">${fmtEGP(h.invested)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Current Value</div>
        <div class="metric-value font-mono">${fmtEGP(h.currentValue)}</div>
      </div>
    </div>
    <div class="holding-pnl">
      <span class="pnl-label">Profit / Loss</span>
      <span class="pnl-value ${pnlCls} font-mono">${sign}${fmtEGP(h.pnl)}</span>
      <span class="pnl-badge ${pnlCls}">${sign}${h.pnlPct.toFixed(2)}%</span>
    </div>
  ` : `
    <div class="holding-metrics">
      <div class="metric">
        <div class="metric-label">Buy Price</div>
        <div class="metric-value font-mono">${fmtEGP(h.buyPrice)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Invested</div>
        <div class="metric-value font-mono">${fmtEGP(h.invested)}</div>
      </div>
    </div>
    <p class="price-unavailable">⚠ Live price unavailable for K${h.karat}</p>
  `;

  return `
    <div class="holding-card" id="card-${h.id}">
      <div class="holding-card-header">
        <span class="holding-karat-badge">${KARAT_LABELS[h.karat] || `K${h.karat}`}</span>
        <div class="holding-card-actions">
          <button class="btn-icon" title="Edit" onclick="openModal('${h.id}')">✏</button>
          <button class="btn-icon delete" title="Delete" onclick="deleteHolding('${h.id}')">🗑</button>
        </div>
      </div>
      <div class="holding-name">${h.grams} grams · K${h.karat}</div>
      <div class="holding-date">Bought ${fmtDate(h.boughtAt)}</div>
      ${metricsHTML}
    </div>
  `;
}

// ─── Modal: open / close ──────────────────────────────────────────────────────
window.openModal = function(id = null) {
  editingId = id;
  const modal  = $('#modal-overlay');
  const title  = $('#modal-title');
  const form   = $('#holding-form');
  const delBtn = $('#btn-delete-modal');

  form.reset();
  hideFormError();

  if (id) {
    const h = holdings.find(x => x.id === id);
    if (!h) return;
    title.textContent                       = 'Edit Holding';
    $('#field-karat').value                 = h.karat;
    $('#field-grams').value                 = h.grams;
    $('#field-buy-price').value             = h.buyPrice;
    $('#field-bought-at').value             = h.boughtAt ? h.boughtAt.slice(0, 10) : '';
    delBtn.style.display                    = 'flex';
  } else {
    title.textContent    = 'Add Holding';
    delBtn.style.display = 'none';
  }

  modal.classList.add('open');
  setTimeout(() => $('#field-grams').focus(), 300);
};

window.closeModal = function() {
  $('#modal-overlay').classList.remove('open');
  editingId = null;
};

// Close on overlay click
$('#modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ─── Modal: save ─────────────────────────────────────────────────────────────
$('#holding-form').addEventListener('submit', (e) => {
  e.preventDefault();
  hideFormError();

  const karat    = parseInt($('#field-karat').value, 10);
  const grams    = parseFloat($('#field-grams').value);
  const buyPrice = parseFloat($('#field-buy-price').value);
  const boughtAt = $('#field-bought-at').value || null;

  if (!karat || isNaN(grams) || grams <= 0 || isNaN(buyPrice) || buyPrice <= 0) {
    showFormError('Please fill in all required fields with valid numbers.');
    return;
  }

  if (editingId) {
    holdings = holdings.map(h =>
      h.id === editingId ? { ...h, karat, grams, buyPrice, boughtAt } : h
    );
  } else {
    holdings.push({
      id: crypto.randomUUID(),
      karat,
      grams,
      buyPrice,
      boughtAt,
    });
  }

  saveHoldings(holdings);
  closeModal();
  renderHoldings();
  renderSinceLastVisit();
});

// ─── Modal: delete from modal ────────────────────────────────────────────────
$('#btn-delete-modal').addEventListener('click', () => {
  if (editingId) deleteHolding(editingId, true);
});

// ─── Delete holding ───────────────────────────────────────────────────────────
window.deleteHolding = function(id, fromModal = false) {
  const h = holdings.find(x => x.id === id);
  if (!h) return;

  // Native confirm — no dependencies
  if (!confirm(`Delete this ${h.grams}g K${h.karat} holding? This cannot be undone.`)) return;

  holdings = holdings.filter(x => x.id !== id);
  saveHoldings(holdings);
  if (fromModal) closeModal();
  renderHoldings();
  renderSinceLastVisit();
};

// ─── Error/form helpers ───────────────────────────────────────────────────────
function showFormError(msg) {
  const el = $('#form-error');
  el.textContent = msg;
  el.classList.add('show');
}

function hideFormError() {
  $('#form-error').classList.remove('show');
}

// ─── Header ticker ────────────────────────────────────────────────────────────
function updateTicker() {
  const dot   = $('#ticker-dot');
  const label = $('#ticker-label');
  const val   = $('#ticker-karat-val');
  const ts    = $('#ticker-timestamp');

  if (priceError) {
    dot.className   = 'ticker-dot error';
    label.textContent = 'Price unavailable';
    val.textContent   = '';
    if (ts) ts.textContent = '';
    return;
  }

  if (!priceData) return;

  const k21 = priceData.karats?.k21;
  if (k21) {
    dot.className     = 'ticker-dot';
    label.textContent = 'K21 sell';
    val.textContent   = fmtEGP(k21.sellPerGram);
  }

  if (ts && priceData.fetchedAt) {
    ts.textContent = `Updated ${fmtDateTime(priceData.fetchedAt)}`;
  }
}

// ─── Offline / error banner ───────────────────────────────────────────────────
function showOfflineBanner(msg) {
  const el = $('#offline-banner');
  el.querySelector('.offline-msg').textContent = msg;
  el.classList.remove('hidden');
}

// ─── PWA install prompt ───────────────────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = $('#install-banner');
  if (banner) banner.classList.add('show');
});

window.triggerInstall = async function() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    $('#install-banner')?.classList.remove('show');
    deferredInstallPrompt = null;
  }
};

window.dismissInstall = function() {
  $('#install-banner')?.classList.remove('show');
};

// ─── Service Worker registration ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  // Load holdings first — we can render the skeleton/empty state immediately
  holdings = loadHoldings();
  showSkeleton();

  try {
    priceData  = await getCurrentGoldPrices();
    priceError = false;
  } catch (err) {
    priceError = true;
    console.warn('Could not fetch prices.json:', err);
    showOfflineBanner(
      'Could not load live prices — check your connection or wait for the next update.'
    );
  }

  updateTicker();
  renderHoldings();
  renderSinceLastVisit();

  // Show prices source info
  if (priceData?.fetchedAt) {
    const infoEl = $('#prices-info-ts');
    if (infoEl) infoEl.textContent = fmtDateTime(priceData.fetchedAt);
  }
}

document.addEventListener('DOMContentLoaded', init);
