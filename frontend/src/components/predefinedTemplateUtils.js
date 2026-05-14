const TEMPLATE_RULES = [
  { key: 'KPI', patterns: ['give me healthcare dashboard report', 'kpi'] },
  { key: 'REV', patterns: ['revenue by service this month', 'rev'] },
  { key: 'PT', patterns: ['total patients served today', 'pt'] },
  { key: 'DOC', patterns: ['doctor performance ranking', 'doc'] },
  { key: 'RISK', patterns: ['active vs critical patient count', 'risk'] },
  { key: 'ALRT', patterns: ['abnormal vitals alerts summary', 'alrt'] },
  { key: 'LOAD', patterns: ['patients per doctor', 'patient per doctor', 'load'] },
  { key: 'REG', patterns: ['region wise patient distribution', 'reg'] },
  { key: 'PAY', patterns: ['pending payment cases', 'pay'] },
  { key: 'TRND', patterns: ['patient outcome trends', 'trnd'] },
  { key: 'AUTH', patterns: ['login attempts', 'auth failures', 'unauthorized access', 'security report', '401'] },
];

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPredefinedTemplateKey(query) {
  const q = normalizeText(query);
  if (!q) return null;
  for (const rule of TEMPLATE_RULES) {
    const isMatch = rule.patterns.some((pattern) => {
      const p = normalizeText(pattern);
      // Short aliases (kpi/rev/pay/...) must be exact-only to avoid accidental matches.
      if (p.length <= 4) {
        return q === p;
      }
      // Long phrases can match exact or "query contains phrase".
      return q === p || q.includes(p);
    });
    if (isMatch) return rule.key;
  }
  return null;
}
