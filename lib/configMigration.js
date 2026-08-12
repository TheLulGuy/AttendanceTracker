export function migrateConfig(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.schedule) return null;
  return {
    ...parsed,
    threshold: parsed.threshold || 75,
    holidays: (parsed.holidays || []).map(h => ({
      date: h.date || h.startDate,
      ...(h.endDate && h.endDate !== (h.date || h.startDate) ? { endDate: h.endDate } : {}),
      label: h.label,
    })),
  };
}
