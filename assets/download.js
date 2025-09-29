let manifest = [];

async function loadManifest(){
  const res = await fetch('assets/data/download_manifest.json');
  manifest = await res.json();
}

function unique(key){
  return [...new Set(manifest.map(x=>x[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
}

function populate(){
  const ph = document.getElementById('dlPhenotype');
  unique('Phenotype').forEach(v=>ph.insertAdjacentHTML('beforeend', `<option>${v}</option>`));
}

function filterManifest(){
  const ph = document.getElementById('dlPhenotype').value;
  const ty = document.getElementById('dlType').value;
  const me = document.getElementById('dlMethod').value;

  return manifest.filter(x =>
    (!ph || x.Phenotype===ph) &&
    (!ty || x.Type===ty) &&
    (!me || x.Method===me)
  );
}

function renderCards(list){
  const box = document.getElementById('dlResults');
  box.innerHTML = '';
  if(list.length===0){
    box.innerHTML = `<div class="card"><h3>No matches</h3><p>Try relaxing filters.</p></div>`;
    return;
  }

  list.forEach(item=>{
    const title = `${item.Phenotype} • ${item.Type} • ${item.Method}`;
    const chips = `
      <span class="chip">${item.Phenotype}</span>
      <span class="chip">${item.Type}</span>
      <span class="chip">${item.Method}</span>
    `;
    const path = `assets/data/downloads/${item.File}`;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${title}</h3>
      <p>${chips}</p>
      <div class="actions">
        <a class="btn primary" href="${path}" download>Download CSV</a>
        <a class="btn" href="${path}" target="_blank" rel="noopener">Preview</a>
      </div>
    `;
    box.appendChild(card);
  });
}

function applyFilters(){
  renderCards(filterManifest());
}

function initReset(){
  document.getElementById('dlResetBtn').addEventListener('click', ()=>{
    ['dlPhenotype','dlType','dlMethod'].forEach(id=>{
      const el = document.getElementById(id);
      el.selectedIndex = 0;
    });
    applyFilters();
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await loadManifest();
  populate();
  initReset();
  ['dlPhenotype','dlType','dlMethod'].forEach(id=>{
    document.getElementById(id).addEventListener('change', applyFilters);
  });
  applyFilters();
});
