// Lahat ng petsa/oras sa app ay ipinapakita sa Philippine time (Asia/Manila),
// kahit anong timezone ng server o browser. Iisang lugar lang para sa formatting.
const TZ = 'Asia/Manila';
const LOCALE = 'en-PH';

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric', timeZone: TZ });
}

export function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}
