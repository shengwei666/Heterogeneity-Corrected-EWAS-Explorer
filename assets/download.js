// assets/download.js — Render downloadable CSV list from a local manifest
// Uses absolute URLs so it works under a subpath like "/hetero-ewas-explorer/".

const PROJECT_SLUG = 'hetero-ewas-explorer'; // <-- adjust if your folder/repo name changes
const MANIFEST_REL = 'data/downloads/index.json';
const CSV_DIR_REL  = 'data/downloads';

// Base URL detection
function detectBasePrefix() {
  const p = location.pathname;
  const marker = `/${PROJECT_SLUG}/`;
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(0, i + marker.length);
  return p.endsWith('/') ? p : p.replace(/[^/]+$/, '');
}
const BASE_PATH = detectBasePrefix();
const BASE_URL  = new URL(BASE_PATH, location.origin);
function abs(urlLike) { return new URL(urlLike, BASE_URL).href; }

const MANIFEST_URL = abs(MANIFEST_REL);
function csvAbsUrl(name) { return abs(`${CSV_DIR_REL}/${name}`); }

let allFiles = [];   // [{name, url, phenotype, type, method, sizeBytes?}]
let filtered = [];

function parseByFilename(name) {
  // Expected: Phenotype_Type_Method.csv (e.g., AD_Survival_Beta.csv)
  const base = name.replace(/\.csv$/i, '');
  const parts = base.split('_');
  const phenotype = parts[0] || '';
  const type = parts[1] || '';
  const method = parts[2] || '';
  return { phenotype, type, method };
}

function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

async function headSize(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return undefined;
    const len = res.headers.get('Content-Length');
    const n = len ? Number(len) : NaN;
    return Number.isFinite(n) ? n : undefined;
  } catch (_) {
    return undefined;
  }
}

function uniqueValues(arr, key) {
  return [...new Set(arr.map(d => d[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function populateSelects() {
  const ph = document.getElementById('fPhenotype');
  uniqueValues(allFiles, 'phenotype').forEach(v => ph.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
}

function applyFilters() {
  const ph = document.getElementById('fPhenotype').value;
  const ty = document.getElementById('fType').value;
  const me = document.getElementById('fMethod').value;
  const q  = document.getElementById('fQuery').value.trim().toLowerCase();

  filtered = allFiles.filter(f => {
    return (!ph || f.phenotype === ph)
        && (!ty || f.type === ty)
        && (!me || f.method === me)
        && (!q  || f.name.toLowerCase().includes(q));
  });

  renderTable();
}

function renderTable() {
  const tbody = document.querySelector('#dlTable tbody');
  tbody.innerHTML = '';
  for (const f of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.name}</td>
      <td>${f.phenotype || ''}</td>
      <td>${f.type || ''}</td>
      <td>${f.method || ''}</td>
      <td>${typeof f.sizeBytes === 'number' ? humanSize(f.sizeBytes) : ''}</td>
      <td><a class="btn ghost" href="${f.url}" download>Download</a></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('dlCount').textContent = `${filtered.length} file(s)`;
}

function initFilters() {
  document.getElementById('dlReset').addEventListener('click', () => {
    ['fPhenotype','fType','fMethod','fQuery'].forEach(id => {
      const el = document.getElementById(id);
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    applyFilters();
  });

  ['fPhenotype','fType','fMethod','fQuery'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });
}

async function loadManifest() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${MANIFEST_URL}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.files)) throw new Error('Manifest must be a JSON object with a "files" array.');
  return json.files
    .filter(name => /\.csv$/i.test(name))
    .map(name => {
      const { phenotype, type, method } = parseByFilename(name);
      return {
        name,
        url: csvAbsUrl(name),
        phenotype,
        type,
        method
      };
    });
}

async function enrichSizesSequential(files) {
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    f.sizeBytes = await headSize(f.url);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    allFiles = await loadManifest();
    populateSelects();

    await enrichSizesSequential(allFiles);

    filtered = allFiles.slice();
    renderTable();
    initFilters();
  } catch (e) {
    const tbody = document.querySelector('#dlTable tbody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">
      Failed to load manifest: ${String(e?.message || e)}<br>
      Make sure <code>${MANIFEST_URL}</code> exists and lists your CSV files.
    </td></tr>`;
    document.getElementById('dlCount').textContent = `0 file(s)`;
  }
});
