document.addEventListener('DOMContentLoaded', () => {
  // Smooth copy citation
  const copyBtn = document.getElementById('copyCitationBtn');
  if(copyBtn){
    copyBtn.addEventListener('click', async ()=>{
      const txt = `Your Name et al. Heterogeneity-corrected EWAS meta-analysis via CHALM and CAMDA transformations. Preprint/Journal, 2025. DOI: TBD.`;
      try{
        await navigator.clipboard.writeText(txt);
        copyBtn.textContent = 'Copied!';
        setTimeout(()=>copyBtn.textContent = 'Copy citation', 1400);
      }catch(e){
        alert('Copy failed. Please copy manually.');
      }
    });
  }

  // Smooth anchor scroll only within index
  if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) {
    document.querySelectorAll('a.nav-link[href^="#"], a[href^="index.html#"]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        const id = a.getAttribute('href').split('#')[1];
        const el = document.getElementById(id);
        if(el){
          e.preventDefault();
          el.scrollIntoView({behavior:'smooth', block:'start'});
          history.replaceState(null, '', `#${id}`);
        }
      });
    });
  }
});
