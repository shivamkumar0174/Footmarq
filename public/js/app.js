// ── Service Logo Emoji Map ────────────────────────────────
const SERVICE_LOGOS = {
  spotify: '🎵', netflix: '🎬', youtube: '▶️', twitch: '🟣',
  disney: '✨', soundcloud: '🔊', twitter: '🐦', instagram: '📸',
  linkedin: '💼', reddit: '🤘', discord: '🎮', quora: '❓',
  pinterest: '📌', tumblr: '📝', amazon: '📦', flipkart: '🛒',
  myntra: '👗', zara: '🧥', nike: '👟', etsy: '🎨', ajio: '🛍️',
  paypal: '💰', razorpay: '💳', wise: '🌍', coinbase: '₿',
  groww: '📈', zerodha: '📊', github: '🐱', vercel: '▲',
  railway: '🚂', digitalocean: '🌊', npm: '📦', notion: '📓',
  slack: '💬', figma: '🎯', trello: '📋', zoom: '🎥', loom: '🎞️',
  linear: '⚡', '1password': '🔑', steam: '🎮', epicgames: '🕹️',
  xbox: '🟢', makemytrip: '✈️', airbnb: '🏠', booking: '🏨',
  coursera: '📚', udemy: '🎓', khanacademy: '🦊', apollo: '💊',
  dropbox: '📦', lastfm: '🎵', adobe: '🅰️', default: '🌐'
};

function getServiceLogo(logoKey) {
  return SERVICE_LOGOS[logoKey] || SERVICE_LOGOS[logoKey.toLowerCase()] || SERVICE_LOGOS.default;
}

// ── Risk Color Map ────────────────────────────────────────
const RISK_COLORS = {
  low: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

function getRiskColor(level) {
  return RISK_COLORS[level] || RISK_COLORS.low;
}

// ── Search Filter ─────────────────────────────────────────
function initSearch() {
  const searchInput = document.getElementById('account-search');
  if (!searchInput) return;
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.account-card, .account-list-row').forEach(el => {
      const name = el.dataset.name?.toLowerCase() || '';
      const domain = el.dataset.domain?.toLowerCase() || '';
      el.style.display = (name.includes(q) || domain.includes(q)) ? '' : 'none';
    });
  });
}

// ── View Toggle ───────────────────────────────────────────
function initViewToggle() {
  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');
  const gridView = document.getElementById('accounts-grid-view');
  const listView = document.getElementById('accounts-list-view');
  if (!gridBtn || !listBtn) return;

  gridBtn.addEventListener('click', () => {
    gridView.style.display = '';
    listView.style.display = 'none';
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  });
  listBtn.addEventListener('click', () => {
    gridView.style.display = 'none';
    listView.style.display = '';
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
  });
}

// ── OTP Inputs ────────────────────────────────────────────
function initOTP() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((input, i) => {
    input.addEventListener('keyup', (e) => {
      if (e.key >= '0' && e.key <= '9' && i < inputs.length - 1) {
        inputs[i + 1].focus();
      }
      if (e.key === 'Backspace' && i > 0 && !input.value) {
        inputs[i - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      const text = e.clipboardData.getData('text').replace(/\D/g, '');
      [...text].slice(0, inputs.length).forEach((c, j) => {
        if (inputs[j]) inputs[j].value = c;
      });
      e.preventDefault();
    });
  });
}

// ── Score Gauge Animation ─────────────────────────────────
function initScoreGauge() {
  const fill = document.querySelector('.gauge-fill');
  if (!fill) return;
  const score = parseInt(fill.dataset.score || '0');
  const circ = 2 * Math.PI * 60; // radius = 60
  const offset = circ - (score / 100) * circ;
  fill.style.strokeDasharray = circ;
  fill.style.strokeDashoffset = circ;
  setTimeout(() => { fill.style.strokeDashoffset = offset; }, 100);
}

// ── Scan Progress Animation ───────────────────────────────
function animateScan() {
  const statuses = [
    'Connecting to Gmail API...',
    'Scanning inbox metadata...',
    'Matching service signatures...',
    'Identifying 71 accounts...',
    'Running breach check...',
    'Computing risk scores...',
    'Almost done...',
  ];
  const el = document.getElementById('scan-status-text');
  if (!el) return;
  let i = 0;
  const interval = setInterval(() => {
    el.textContent = statuses[i % statuses.length];
    i++;
    if (i >= statuses.length) {
      clearInterval(interval);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    }
  }, 900);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
    return c;
  })();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icons[type]}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── Sort Accounts ─────────────────────────────────────────
function initSortSelect() {
  const sel = document.getElementById('sort-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('sort', sel.value);
    window.location.href = url.toString();
  });
}

// ── Sidebar Active State ──────────────────────────────────
function initSidebar() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (path === href || (href !== '/' && path.startsWith(href)))) {
      link.classList.add('active');
    }
  });
}

// ── Onboarding Steps ──────────────────────────────────────
let currentStep = 1;
function initOnboarding() {
  const totalSteps = 4;
  showStep(currentStep);
}
function showStep(step) {
  document.querySelectorAll('.onboarding-step').forEach((el, i) => {
    el.style.display = (i + 1 === step) ? '' : 'none';
  });
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 === step) dot.classList.add('active');
    if (i + 1 < step) dot.classList.add('done');
  });
}
function nextStep() {
  currentStep++;
  if (currentStep === 3) {
    showStep(3);
    animateScan();
    return;
  }
  if (currentStep > 4) { window.location.href = '/dashboard'; return; }
  showStep(currentStep);
}
function prevStep() {
  if (currentStep > 1) { currentStep--; showStep(currentStep); }
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initSearch();
  initViewToggle();
  initOTP();
  initScoreGauge();
  initSortSelect();
  if (document.querySelector('.onboarding-step')) initOnboarding();
});
