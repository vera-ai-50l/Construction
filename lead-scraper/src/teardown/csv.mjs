const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsvRows = (head, rows) => [head.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n') + '\n';
