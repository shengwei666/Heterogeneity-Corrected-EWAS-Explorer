// assets/csvWorker.js — Papa Parse in a Web Worker: stream and batch rows to the main thread.
importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js');

self.onmessage = (e) => {
  const { url, fileLabel = '', batchSize = 2000 } = e.data || {};
  if (!url) {
    self.postMessage({ type: 'error', error: 'No CSV URL provided.', fileLabel });
    return;
  }

  let buffer = [];
  let totalCount = 0;

  const flush = () => {
    if (buffer.length) {
      self.postMessage({ type: 'rows', rows: buffer, fileLabel });
      buffer = [];
    }
  };

  Papa.parse(url, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    worker: false, // already inside a Worker
    chunk: (results) => {
      const rows = (results.data || []).map((d) => ({
        Phenotype: d.Phenotype,
        Tissue:    d.Tissue,
        Type:      d.Type,
        Method:    d.Method,
        N:         +d.N,
        CpG:       d.CpG,
        Location:  d.Location,
        Gene:      d.Gene,
        Beta:      +d.Beta,
        P:         +d.P,
        Source:    fileLabel
      }));

      buffer.push(...rows);
      totalCount += rows.length;
      if (buffer.length >= batchSize) flush();
    },
    complete: () => {
      flush();
      self.postMessage({ type: 'complete', total: totalCount, fileLabel });
    },
    error: (err) => {
      self.postMessage({ type: 'error', error: err?.message || String(err), fileLabel });
    }
  });
};
