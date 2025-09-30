// assets/explore.js — Local manifest + Papa Parse in a Web Worker
// Subpath-safe (absolute URLs) + clickable sort indicators (⇅ ▲ ▼).

// ===== Config =====
const PROJECT_SLUG = 'hetero-ewas-explorer'; // <-- change if your folder/repo name changes
const PAGE_SIZE = 12;
const UPDATE_INTERVAL_MS = 300; // throttle table updates (ms)
const MANIFEST_REL = 'data/downloads/index.json';
const CSV_DIR_REL  = 'data/downloads';
// ==================

// ----- Base URL detection (subpath-aware) -----
function detectBasePrefix() {
  const p = location.pathname;
  const marker = `/${PROJECT_SLUG}/`;
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(0, i + marker.length); // e.g. "/hetero-ewas-explorer/"
  // Fallback: current page directory (trailing slash)
  return p.endsWith('/') ? p : p.replace(/[^/]+$/, '');
}
const BASE_PATH = detectBasePrefix();                  // e.g. "/hetero-ewas-explorer/"
const BASE_URL  = new URL(BASE_PATH, location.origin); // e.g. "http://127.0.0.1:5500/hetero-ewas-explorer/"

// Build absolute URLs
function abs(urlLike) { return new URL(urlLike, BASE_URL).href; }
const MANIFEST_URL = abs(MANIFEST_REL);
function csvAbsUrl(name) { return abs(`${CSV_DIR_REL}/${name}`); }
const WORKER_URL = new URL('assets/csvWorker.js', BASE_URL); // absolute URL for Worker

// ----- State -----
let rawData = [];
let filtered = [];
let sortKey = 'P';
let sortAsc = true;
let page = 1;

let hasPopulatedSelects = false;
let lastRenderTs = 0;
let loadingState = { totalFiles: 0, completedFiles: 0 };
let totalRowsLoaded = 0;
const errorLog = [];

// ----- Helpers -----
function uniqueValues(arr, key) {
  return [...new Set(arr.map(d => d[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function formatNumber(x) {
  if (x == null || x === '') return '';
  const n = Number(x);
  if (!isFinite(n)) return String(x);
  if (Math.abs(n) < 1e-3 || Math.abs(n) >= 1e4) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function sortData() {
  const key = sortKey;
  filtered.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (key === 'N' || key === 'Beta' || key === 'P') { va = Number(va); vb = Number(vb); }
    const cmp = (typeof va === 'number' && typeof vb === 'number')
      ? (va - vb)
      : String(va).localeCompare(String(vb));
    return sortAsc ? cmp : -cmp;
  });
}

// ----- UI -----
function populateSelectsOnce() {
  if (hasPopulatedSelects || rawData.length === 0) return;
  const ph = document.getElementById('phenotype');
  const ti = document.getElementById('tissue');
  uniqueValues(rawData, 'Phenotype').forEach(v => ph.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
  uniqueValues(rawData, 'Tissue').forEach(v => ti.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
  hasPopulatedSelects = true;
}

function renderTable(force = false) {
  const now = performance.now();
  if (!force && now - lastRenderTs < UPDATE_INTERVAL_MS) return;
  lastRenderTs = now;

  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = '';

  const start = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);
  for (const d of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.Phenotype ?? ''}</td>
      <td>${d.Tissue ?? ''}</td>
      <td>${d.Type ?? ''}</td>
      <td>${d.Method ?? ''}</td>
      <td>${d.N ?? ''}</td>
      <td>${d.CpG ?? ''}</td>
      <td>${d.Location ?? ''}</td>
      <td>${d.Gene ?? ''}</td>
      <td>${formatNumber(d.Beta)}</td>
      <td>${formatNumber(d.P)}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('rowCount').textContent = `${filtered.length} rows`;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  document.getElementById('pageInfo').textContent = `Page ${page} / ${totalPages}`;
  document.getElementById('prevPage').disabled = (page <= 1);
  document.getElementById('nextPage').disabled = (page >= totalPages);
}

// ----- Sort indicators (⇅ ▲ ▼) -----
function ensureSortIndicators() {
  document.querySelectorAll('#resultsTable thead th').forEach(th => {
    const key = th.dataset.sort;
    if (!key) return;
    // If an indicator span is missing, append it
    if (!th.querySelector('.sort-ind')) {
      const ind = document.createElement('span');
      ind.className = 'sort-ind';
      ind.textContent = '⇅'; // default unsorted
      th.appendChild(ind);
    }
    th.classList.add('th-sortable');
    th.tabIndex = 0; // keyboard focusable
    th.setAttribute('role', 'button');
    th.setAttribute('aria-sort', 'none');
  });
}

function updateSortIndicators() {
  document.querySelectorAll('#resultsTable thead th').forEach(th => {
    const key = th.dataset.sort;
    if (!key) return;
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    if (key === sortKey) {
      ind.textContent = sortAsc ? '▲' : '▼';
      th.setAttribute('aria-sort', sortAsc ? 'ascending' : 'descending');
    } else {
      ind.textContent = '⇅';
      th.setAttribute('aria-sort', 'none');
    }
  });
}

// ----- Interactions -----
function initSort() {
  ensureSortIndicators();
  updateSortIndicators();

  document.querySelectorAll('#resultsTable thead th').forEach(th => {
    const key = th.dataset.sort;
    if (!key) return;

    const toggle = () => {
      if (sortKey === key) { sortAsc = !sortAsc; }
      else { sortKey = key; sortAsc = true; }
      sortData();
      updateSortIndicators();
      renderTable(true);
    };

    th.addEventListener('click', toggle);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

function initPager() {
  document.getElementById('prevPage').addEventListener('click', () => {
    if (page > 1) { page--; renderTable(true); }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page < totalPages) { page++; renderTable(true); }
  });
}

function initReset() {
  document.getElementById('resetBtn').addEventListener('click', () => {
    ['phenotype', 'tissue', 'type', 'method', 'search'].forEach(id => {
      const el = document.getElementById(id);
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    applyFilters();
    updateSortIndicators();
  });
}

function renderLoadingStatus() {
  const { totalFiles, completedFiles } = loadingState;
  const footer = document.getElementById('tableFooter');
  if (!footer) return;
  const statusId = 'loadingStatus';
  let el = document.getElementById(statusId);
  if (!el) {
    el = document.createElement('div');
    el.id = statusId;
    el.style.opacity = '0.85';
    el.style.whiteSpace = 'pre-line';
    footer.prepend(el);
  }
  let msg = '';
  if (totalFiles > 0 && completedFiles < totalFiles) {
    msg = `Loading CSVs: ${completedFiles} / ${totalFiles} completed…\nRows loaded: ${totalRowsLoaded}`;
  } else if (totalFiles > 0) {
    msg = `Loaded ${completedFiles} CSV file(s). Rows loaded: ${totalRowsLoaded}`;
  }
  if (errorLog.length) {
    msg += `\nErrors (${errorLog.length}):\n- ` + errorLog.join('\n- ');
  }
  el.textContent = msg;
}

function applyFilters() {
  const ph = document.getElementById('phenotype').value;
  const ti = document.getElementById('tissue').value;
  const ty = document.getElementById('type').value;
  const me = document.getElementById('method').value;
  const q  = document.getElementById('search').value.trim().toLowerCase();

  filtered = rawData.filter(d => {
    return (!ph || d.Phenotype === ph)
      && (!ti || d.Tissue === ti)
      && (!ty || d.Type === ty)
      && (!me || d.Method === me)
      && (!q  || [d.CpG, d.Location, d.Gene].some(x => String(x ?? '').toLowerCase().includes(q)));
  });

  sortData();
  page = 1;
  renderTable(true);
}

// ----- Manifest + Loading -----
async function loadManifest() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${MANIFEST_URL}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.files)) {
    throw new Error('Manifest must be a JSON object with a "files" array.');
  }
  return json.files
    .filter(name => /\.csv$/i.test(name))
    .map(name => ({ name, url: csvAbsUrl(name) }));
}

function loadCsvWithWorker(url, name) {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL, { type: 'classic' });

    worker.onmessage = (e) => {
      const { type, rows, total, error } = e.data || {};
      if (type === 'rows') {
        rawData.push(...rows);
        totalRowsLoaded += rows.length;

        if (!hasPopulatedSelects) populateSelectsOnce();

        if (filtered.length === 0) {
          filtered = rawData.slice();
          sortData();
          updateSortIndicators();
          renderTable(); // initial paint
        } else {
          applyFilters();
        }
        renderLoadingStatus();
      } else if (type === 'complete') {
        loadingState.completedFiles++;
        renderLoadingStatus();

        if (!hasPopulatedSelects) populateSelectsOnce();
        if (filtered.length === 0) { filtered = rawData.slice(); sortData(); }
        updateSortIndicators();
        renderTable(true);

        resolve({ name, rows: total || 0 });
        worker.terminate();
      } else if (type === 'error') {
        loadingState.completedFiles++;
        errorLog.push(`${name}: ${String(error)}`);
        renderLoadingStatus();
        console.error('CSV worker error:', name, error);
        resolve({ name, rows: 0, error: String(error) });
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      loadingState.completedFiles++;
      errorLog.push(`${name}: ${String(err?.message || err)}`);
      renderLoadingStatus();
      console.error('Worker runtime error:', name, err?.message || err);
      resolve({ name, rows: 0, error: String(err?.message || err) });
      worker.terminate();
    };

    worker.postMessage({ url, fileLabel: name, batchSize: 4000 });
  });
}

async function loadAllCSVsSequentially() {
  const files = await loadManifest();
  loadingState.totalFiles = files.length;
  loadingState.completedFiles = 0;
  renderLoadingStatus();

  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    await loadCsvWithWorker(f.url, f.name);
  }
}

// ----- Boot -----
document.addEventListener('DOMContentLoaded', async () => {
  initSort();
  initPager();
  initReset();

  ['phenotype', 'tissue', 'type', 'method', 'search'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  try {
    await loadAllCSVsSequentially();
  } catch (e) {
    console.error('Failed to load CSVs:', e);
    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">
      Failed to load CSVs. ${String(e?.message || e)}<br>
      Make sure <code>${MANIFEST_URL}</code> exists and lists your CSV files.
    </td></tr>`;
    document.getElementById('rowCount').textContent = `0 rows`;
    document.getElementById('pageInfo').textContent = `Page 1 / 1`;
    document.getElementById('prevPage').disabled = true;
    document.getElementById('nextPage').disabled = true;
  }
});
