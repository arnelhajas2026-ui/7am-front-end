// Export helpers.
//  - exportCSV: plain CSV download (ginagamit pa ng Audit Trail).
//  - downloadFromApi: kukunin ang file mula sa backend export endpoint (PDF/Word/Excel)
//    dala ang JWT (kaya via axios blob, hindi plain <a href>).

export function exportCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows.map((r) => (Array.isArray(r) ? r.map(esc).join(',') : '')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

// api = axios instance (may JWT interceptor); url + params -> i-download ang resulting file.
export async function downloadFromApi(api, url, params, fallbackName) {
  const res = await api.get(url, { params, responseType: 'blob' });
  let name = fallbackName;
  const cd = res.headers?.['content-disposition'] || '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  if (m) name = m[1];
  triggerDownload(new Blob([res.data]), name);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function stampPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}
