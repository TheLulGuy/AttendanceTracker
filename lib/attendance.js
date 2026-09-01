import { fmt, parseDate } from './dates';
import { MONTHS } from './constants';
import { OWNER_EMAIL } from './constants';

// One-off cancellations: GCGC1021 cancelled on Jul 3
const OVERRIDES = { '2026-07-03': s => s.filter(x => x.course !== 'GCGC1021') };

export function buildSem(semStart, semEnd) {
  const start = parseDate(semStart);
  const end   = parseDate(semEnd);
  if (isNaN(start) || isNaN(end) || end < start) return [];
  const out = [];
  const d = new Date(start);
  while (d <= end) {
    const w = d.getDay();
    if (w >= 1 && w <= 5) out.push({ date:fmt(d), dow:w, day:d.getDate(), month:d.getMonth() });
    d.setDate(d.getDate()+1);
  }
  return out;
}

export function deriveCourses(schedule) {
  const seen = new Map();
  Object.values(schedule).flat().forEach(s => { if (!seen.has(s.course)) seen.set(s.course, s.label); });
  return { COURSES:[...seen.keys()], CLABEL:Object.fromEntries(seen) };
}

export function dispDate(ds) {
  const d = parseDate(ds);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// state[date][slotKey] = true(present) | false(absent); missing → true
export function present(state, ds, key) {
  const d = state[ds];
  return !d || d[key] === undefined ? true : d[key];
}

// ─── Tone helpers — literal class-name branches so Tailwind's static scan finds them ──
export function pillClass(p) {
  return p < 60 ? { bg:'bg-reddim', c:'text-red' }
       : p < 67 ? { bg:'bg-amberdim', c:'text-amber' }
       :           { bg:'bg-cyandim', c:'text-cyan' };
}
export function mixClass(mix) {
  if (mix === 'none')    return { bg:'bg-reddim', text:'text-red' };
  if (mix === 'partial') return { bg:'bg-amberdim', text:'text-amber' };
  return { bg:'bg-cyandim', text:'text-cyan' };
}
export function barTone(pct, threshold) {
  return pct < threshold     ? { text:'text-red', bg:'bg-red' }
       : pct < threshold + 7 ? { text:'text-amber', bg:'bg-amber' }
       :                        { text:'text-cyan', bg:'bg-cyan' };
}

// One bundle of config/state-derived helpers, all closing over the same (config, user, SEM, COURSES) —
// kept as a single factory (not split into standalone pure functions) so App.js's call sites stay
// identical to before this file existed; only where the logic lives changed, not how it's called.
export function makeStatHelpers({ config, user, SEM, COURSES }) {
  function lockedStatus(ds) {
    const h = config.holidays.find(x => ds >= x.date && ds <= (x.endDate || x.date));
    if (h) return { type:'holiday', lbl:h.label };
    const ex = config.exams.find(e => ds >= e.startDate && ds <= e.endDate);
    if (ex) return { type:'exam', lbl:ex.name };
    return null;
  }
  function slotsFor(ds, dow) {
    const base = config.schedule[dow] || [];
    return user?.email === OWNER_EMAIL && OVERRIDES[ds] ? OVERRIDES[ds](base) : base;
  }
  function dayMix(state, ds, dow) {
    const slots = slotsFor(ds, dow);
    if (!slots.length) return 'full';
    const n = slots.filter(s => present(state, ds, s.key)).length;
    return n === slots.length ? 'full' : n === 0 ? 'none' : 'partial';
  }
  function calcStats(state, cutoff) {
    const h = {}, a = {};
    COURSES.forEach(c => { h[c]=0; a[c]=0; });
    for (const d of SEM) {
      if (cutoff && d.date > cutoff) continue;
      if (lockedStatus(d.date)) continue;
      for (const s of slotsFor(d.date, d.dow)) {
        h[s.course]++;
        if (present(state, d.date, s.key)) a[s.course]++;
      }
    }
    let th=0, ta=0;
    COURSES.forEach(c => { th+=h[c]; ta+=a[c]; });
    return { h, a, th, ta };
  }
  function cellClass(d) {
    const lk = lockedStatus(d.date);
    if (lk?.type === 'holiday') return { bg:'bg-holidaybg', text:'text-muted2' };
    if (lk?.type === 'exam')    return { bg:'bg-violetdim', text:'text-violet' };
    return null;
  }
  return { lockedStatus, slotsFor, dayMix, calcStats, cellClass };
}
