// Shared export helpers. Output formats: CSV (download) + PDF (native browser print + .print-sheet).
// Walang third-party dependency — plain CSV Blob lang.

// Gawing CSV mula sa array-of-arrays (AOA) at i-download. May UTF-8 BOM para tama ang
// encoding kapag binuksan sa Excel.
//   rows : Array<Array<string|number>>  — unang row(s) pwedeng header; empty array = blank line
export function exportCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows.map((r) => (Array.isArray(r) ? r.map(esc).join(',') : '')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Helper: today stamp para sa filename (Asia/Manila), hal. 2026-10-07
export function stampPH() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}
