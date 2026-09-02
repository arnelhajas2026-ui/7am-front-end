// Magaan na fuzzy matcher — walang dependency. Nagbabalik ng top-N na pinaka-malapit.
function score(q, name) {
  q = q.toLowerCase().trim();
  const n = name.toLowerCase();
  if (!q) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 850 - n.length;
  if (n.includes(q)) return 650 - n.length;

  // token overlap (bawat salita sa query na may katugmang simula sa pangalan)
  const qt = q.split(/\s+/).filter(Boolean);
  const nt = n.split(/\s+/);
  let overlap = 0;
  for (const t of qt) if (nt.some((x) => x.startsWith(t))) overlap++;
  if (overlap) return 300 * overlap - n.length;

  // subsequence (fuzzy): nasa tamang pagkakasunod ba ang mga letra ng query
  let i = 0;
  for (const ch of n) { if (ch === q[i]) i++; if (i === q.length) break; }
  if (i === q.length) return 120 - n.length;

  return 0;
}

export function matchNames(query, list, limit = 5) {
  if (!query || !query.trim()) return [];
  return list
    .map((name) => ({ name, s: score(query, name) }))
    .filter((x) => x.s > 0 && x.name.toLowerCase() !== query.toLowerCase().trim())
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.name);
}
