// Explore page logic
const PAGE_SIZE = 12;

let rawData = [];
let filtered = [];
let sortKey = 'P';
let sortAsc = true;
let page = 1;

async function loadData(){
  const res = await fetch('assets/data/ewas_meta_sample.json');
  rawData = await res.json();
}

function uniqueValues(key){
  return [...new Set(rawData.map(d=>d[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
}

function populateSelects(){
  const ph = document.getElementById('phenotype');
  const ti = document.getElementById('tissue');
  uniqueValues('Phenotype').forEach(v=> ph.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
  uniqueValues('Tissue').forEach(v=> ti.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
}

function applyFilters(){
  const ph = document.getElementById('phenotype').value;
  const ti = document.getElementById('tissue').value;
  const ty = document.getElementById('type').value;
  const me = document.getElementById('method').value;
  const q = document.getElementById('search').value.trim().toLowerCase();

  filtered = rawData.filter(d=>{
    return (!ph || d.Phenotype===ph)
        && (!ti || d.Tissue===ti)
        && (!ty || d.Type===ty)
        && (!me || d.Method===me)
        && (!q  || [d.CpG,d.Location,d.Gene].some(x=> String(x).toLowerCase().includes(q)));
  });

  sortData();
  page = 1;
  renderTable();
}

function sortData(){
  const key = sortKey;
  filtered.sort((a,b)=>{
    let va = a[key], vb = b[key];
    if(key==='N') { va = Number(va); vb = Number(vb); }
    if(key==='Beta' || key==='P'){ va = Number(va); vb = Number(vb); }
    const cmp = (typeof va === 'number' && typeof vb === 'number')
      ? (va - vb)
      : String(va).localeCompare(String(vb));
    return sortAsc ? cmp : -cmp;
  });
}

function formatNumber(x){
  if(x==null || x==='') return '';
  const n = Number(x);
  if(!isFinite(n)) return String(x);
  if(Math.abs(n) < 1e-3 || Math.abs(n) >= 1e4) return n.toExponential(2);
  return n.toLocaleString(undefined, {maximumFractionDigits: 6});
}

function renderTable(){
  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = '';
  const start = (page-1)*PAGE_SIZE;
  const rows = filtered.slice(start, start+PAGE_SIZE);
  for(const d of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.Phenotype}</td>
      <td>${d.Tissue}</td>
      <td>${d.Type}</td>
      <td>${d.Method}</td>
      <td>${d.N}</td>
      <td>${d.CpG}</td>
      <td>${d.Location}</td>
      <td>${d.Gene}</td>
      <td>${formatNumber(d.Beta)}</td>
      <td>${formatNumber(d.P)}</td>
    `;
    tbody.appendChild(tr);
  }

  // footer
  document.getElementById('rowCount').textContent = `${filtered.length} rows`;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  document.getElementById('pageInfo').textContent = `Page ${page} / ${totalPages}`;
  document.getElementById('prevPage').disabled = (page<=1);
  document.getElementById('nextPage').disabled = (page>=totalPages);
}

function initSort(){
  document.querySelectorAll('#resultsTable thead th').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.sort;
      if(!key) return;
      if(sortKey === key){ sortAsc = !sortAsc; }
      else { sortKey = key; sortAsc = true; }
      sortData();
      renderTable();
    });
  });
}

function initPager(){
  document.getElementById('prevPage').addEventListener('click', ()=>{
    if(page>1){ page--; renderTable(); }
  });
  document.getElementById('nextPage').addEventListener('click', ()=>{
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if(page<totalPages){ page++; renderTable(); }
  });
}

function initReset(){
  document.getElementById('resetBtn').addEventListener('click', ()=>{
    ['phenotype','tissue','type','method','search'].forEach(id=>{
      const el = document.getElementById(id);
      if(el.tagName==='SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
    applyFilters();
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await loadData();
  populateSelects();
  initSort();
  initPager();
  initReset();
  ['phenotype','tissue','type','method','search'].forEach(id=>{
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });
  filtered = rawData.slice();
  sortData();
  renderTable();
});
