import { DAYNAME } from './constants';

const ABBREV = { mon:1, tue:2, wed:3, thu:4, fri:5 };
const SLOT_LINE = /^(\d{1,2}:\d{2})\s+(\S+)$/;

function matchDow(line) {
  const lower = line.trim().toLowerCase();
  for (let dow = 1; dow <= 5; dow++) {
    if (lower === DAYNAME[dow].toLowerCase()) return dow;
  }
  return ABBREV[lower] || null;
}

export function parseScheduleText(text) {
  const schedule = {};
  let currentDow = null;

  text.split('\n').forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;

    const dow = matchDow(line);
    if (dow) { currentDow = dow; return; }

    if (!currentDow) return;
    const m = line.match(SLOT_LINE);
    if (!m) return;

    const [, time, course] = m;
    if (!schedule[currentDow]) schedule[currentDow] = [];
    schedule[currentDow].push({
      key: `${currentDow}-${Date.now()}-${schedule[currentDow].length}`,
      time,
      course,
      label: course,
    });
  });

  Object.keys(schedule).forEach(dow => {
    schedule[dow].sort((a, b) => a.time.localeCompare(b.time));
  });

  return schedule;
}
