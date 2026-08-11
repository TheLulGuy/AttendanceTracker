export function pad(n) { return n < 10 ? '0'+n : ''+n; }
export function fmt(d) { return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
export function parseDate(ds) { return new Date(ds+'T12:00:00'); }
export function addDays(ds, delta) {
  const d = parseDate(ds);
  d.setDate(d.getDate()+delta);
  return fmt(d);
}
