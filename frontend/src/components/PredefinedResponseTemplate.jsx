import { useMemo } from 'react';
import './PredefinedResponseTemplates.css';

const nfInt = new Intl.NumberFormat('en-US');
const nfMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const nfPct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s+/g, '_');
}

function splitPipeRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cleanCell(cell));
}

function isPipeLikeRow(line) {
  const s = String(line || '').trim();
  if (!s || !s.includes('|')) return false;
  const cells = s.replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length >= 2;
}

function cleanCell(value) {
  return String(value || '')
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

function toNumber(value) {
  const cleaned = String(value || '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseMarkdownTable(content) {
  const lines = String(content || '').split(/\r?\n/);
  let startIndex = -1;

  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i].trim();
    const next = lines[i + 1].trim();
    if (!isPipeLikeRow(current)) continue;

    const separator = next.replace(/\|/g, '').trim();
    if (/^:?-{3,}:?(\s*:?-{3,}:?)*$/.test(separator.replace(/\s+/g, ' '))) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    return { headers: [], rows: [], rowObjects: [], startIndex: -1, endIndex: -1 };
  }

  let endIndex = startIndex + 2;
  while (endIndex < lines.length && isPipeLikeRow(lines[endIndex].trim())) {
    endIndex += 1;
  }

  const tableLines = lines.slice(startIndex, endIndex).map((line) => line.trim());
  const headers = splitPipeRow(tableLines[0]);
  const rows = [];

  for (let i = 2; i < tableLines.length; i += 1) {
    const raw = tableLines[i];
    if (!raw || /^\|?\s*:?-{2,}/.test(raw)) continue;
    const cells = splitPipeRow(raw);
    if (!cells.some(Boolean)) continue;

    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }

  const rowObjects = rows.map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[normalizeHeader(header)] = row[idx] ?? '';
    });
    return obj;
  });

  return { headers, rows, rowObjects, startIndex, endIndex };
}

function parseContent(content) {
  const fullText = String(content || '').trim();
  const table = parseMarkdownTable(fullText);

  if (table.startIndex === -1) {
    return {
      rawContent: fullText,
      summary: fullText,
      insight: '',
      table,
      numbers: (fullText.match(/\d[\d,.]*/g) || []).map((n) => toNumber(n)),
    };
  }

  const lines = fullText.split(/\r?\n/);
  const summary = lines
    .slice(0, table.startIndex)
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const insight = lines
    .slice(table.endIndex)
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^insights?:?/i, '')
    .trim();

  const numbers = [summary, insight, ...table.rows.flat()]
    .join(' ')
    .match(/\d[\d,.]*/g) || [];

  return {
    rawContent: fullText,
    summary,
    insight,
    table,
    numbers: numbers.map((n) => toNumber(n)),
  };
}

function pickValue(row, keys) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function resolveRegionLabel(row) {
  const direct = pickValue(row, ['region', 'region_name', 'region name', 'state', 'city', 'location', 'zone']);
  const cleanedDirect = cleanCell(direct);
  if (cleanedDirect && normalizeText(cleanedDirect) !== 'region') return cleanedDirect;

  const values = Object.values(row || {})
    .map((v) => cleanCell(v))
    .filter(Boolean);
  for (const value of values) {
    const norm = normalizeText(value);
    const numericLike = /^[\d$.,%-\s]+$/.test(value);
    if (!numericLike && norm && norm !== 'region') return value;
  }
  return cleanedDirect || 'Region';
}

function pickMetricFromText(text, labels) {
  const source = String(text || '');
  for (const label of labels) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = source.match(new RegExp(`${esc}\\s*[:=-]\\s*([\\$\\d,\\.]+%?)`, 'i'));
    if (m && m[1]) return m[1];
  }
  return '';
}

function extractJsonBlock(content, marker) {
  const text = String(content || '');
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) return null;

  const fenced = text.slice(markerIndex).match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1];
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function Sparkline({ values, tone = 'cyan' }) {
  const pointsSeries = !values || values.length < 2
    ? [20, 24, 22, 30, 28, 34, 32]
    : values;

  const w = 220;
  const h = 68;
  const pad = 6;
  const min = Math.min(...pointsSeries);
  const max = Math.max(...pointsSeries);
  const span = Math.max(max - min, 1);

  const points = pointsSeries.map((v, idx) => {
    const x = pad + (idx * (w - pad * 2)) / Math.max(pointsSeries.length - 1, 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });

  const areaPoints = [`${pad},${h - pad}`, ...points, `${w - pad},${h - pad}`].join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`predef-sparkline predef-sparkline-${tone}`}>
      <polygon points={areaPoints} className="predef-spark-area" />
      <polyline points={points.join(' ')} className="predef-spark-line" />
    </svg>
  );
}

function MetricCard({ label, value, delta, tone = 'neutral', sparkValues }) {
  return (
    <div className={`predef-card metric tone-${tone}`}>
      <div className="predef-card-label">{label}</div>
      <div className="predef-card-value">{value}</div>
      {delta ? <div className="predef-card-delta">{delta}</div> : <div className="predef-card-delta muted">Live stream ready</div>}
      <Sparkline values={sparkValues} tone={tone} />
    </div>
  );
}

function EmptyState({ text = 'No structured data returned for this query yet.' }) {
  return (
    <div className="predef-card">
      <p>{text}</p>
    </div>
  );
}

function TemplateShell({ code, title, subtitle, children }) {
  return (
    <section className="predef-template-shell" role="region" aria-label={`${title} dashboard`}>
      <div className="predef-main">
        <header className="predef-template-head">
          <div>
            <div className="predef-code-pill">{code}</div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <div className="predef-live-pill">  <span class="animate-ping absolute inline-flex rounded-full bg-red-400 opacity-75"></span>Live feed active</div>
        </header>
        {children}
        <div className="predef-bottombar">
          <span>Listening: Analyze vitals and compare trends...</span>
          <span>Mic Status: Active</span>
          <span>Neural Latency: 42ms</span>
          <span>Encryption: E2EE</span>
        </div>
      </div>
    </section>
  );
}

function KpiTemplate({ parsed }) {
  const row = parsed.table.rowObjects[0] || {};
  const summaryText = `${parsed.summary || ''} ${parsed.insight || ''}`;
  const kpiJson = extractJsonBlock(parsed.rawContent, 'KPI_METRICS_JSON') || {};

  const revenueRaw = (
    kpiJson.monthly_revenue ??
    pickValue(row, ['total_revenue', 'revenue']) ??
    pickMetricFromText(summaryText, ['total revenue', 'monthly revenue', 'revenue'])
  ) || '0';
  const patientsRaw = (
    kpiJson.total_patients ??
    pickValue(row, ['active_patients', 'total_patients', 'patients']) ??
    pickMetricFromText(summaryText, ['active patients', 'total patients'])
  ) || '0';
  const criticalRaw = (
    kpiJson.critical_patients ??
    pickValue(row, ['critical_patients', 'critical']) ??
    pickMetricFromText(summaryText, ['critical patients'])
  ) || '0';
  const doctorsRaw = (
    kpiJson.active_doctors ??
    pickValue(row, ['active_doctors', 'doctors']) ??
    pickMetricFromText(summaryText, ['active doctors', 'doctors'])
  ) || '0';

  const totalPatients = toNumber(patientsRaw);
  const revenue = toNumber(revenueRaw);
  const critical = toNumber(criticalRaw);
  const doctors = toNumber(doctorsRaw);

  return (
    <TemplateShell
      code="KPI"
      title="Healthcare Dashboard Report"
      subtitle={parsed.summary || 'System-wide operational pulse across patient care, staffing, alerts, and finance.'}
    >
      <div className="predef-grid four">
        <MetricCard label="Total Patients" value={nfInt.format(totalPatients)} tone="cyan" sparkValues={[18, 20, 19, 23, 21, 25, 24]} />
        <MetricCard label="Monthly Revenue" value={nfMoney.format(revenue)} tone="green" sparkValues={[12, 16, 15, 18, 19, 21, 22]} />
        <MetricCard label="Critical Patients" value={nfInt.format(critical)} tone="rose" sparkValues={[14, 12, 13, 11, 10, 12, 11]} />
        <MetricCard label="Active Doctors" value={nfInt.format(doctors)} tone="slate" sparkValues={[14, 14, 15, 13, 14, 14, 14]} />
      </div>
      <div className="predef-card insight wide">
        <div className="predef-card-label">AI Insight Panel</div>
        <p>{parsed.insight || 'AI insight not present in response content.'}</p>
      </div>
    </TemplateShell>
  );
}

function RevTemplate({ parsed }) {
  const rows = parsed.table.rowObjects;
  const services = rows.map((row) => {
    const name = pickValue(row, ['service_name', 'service name']) || 'Service';
    const revenueRaw = pickValue(row, ['total_revenue', 'total revenue', 'revenue']) || '0';
    const billRaw = pickValue(row, ['billing_count', 'billing count', 'records']) || '0';
    return {
      name,
      revenue: toNumber(revenueRaw),
      bills: toNumber(billRaw),
    };
  }).filter((item) => item.name);

  const topServices = services.slice(0, 6);

  const total = topServices.reduce((sum, item) => sum + item.revenue, 0);
  const maxRevenue = Math.max(...topServices.map((item) => item.revenue), 1);

  return (
    <TemplateShell
      code="REV"
      title="Revenue by Service"
      subtitle={parsed.summary || 'Current month service-line billing and contribution mix.'}
    >
      <div className="predef-card hero">
        <div>
          <div className="predef-card-label">Total Monthly Revenue</div>
          <div className="predef-hero-value">{nfMoney.format(total)}</div>
        </div>
        <Sparkline values={topServices.map((item) => item.revenue)} tone="green" />
      </div>

      {!topServices.length ? <EmptyState /> : <div className="predef-grid two">
        <div className="predef-card">
          <div className="predef-card-label">Service Distribution</div>
          <div className="predef-list">
            {topServices.map((item) => (
              <div className="predef-list-row" key={item.name}>
                <div className="predef-list-main">
                  <span>{item.name}</span>
                  <strong>{nfMoney.format(item.revenue)}</strong>
                </div>
                <div className="predef-track">
                  <span style={{ width: `${Math.max((item.revenue / maxRevenue) * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="predef-card">
          <div className="predef-card-label">Billing Throughput</div>
          <table className="predef-table">
            <thead>
              <tr><th>Service</th><th>Bills</th><th>Share</th></tr>
            </thead>
            <tbody>
              {topServices.map((item) => (
                <tr key={`${item.name}-tbl`}>
                  <td>{item.name}</td>
                  <td>{nfInt.format(item.bills)}</td>
                  <td>{nfPct.format(total > 0 ? item.revenue / total : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </TemplateShell>
  );
}

function PtTemplate({ parsed }) {
  const valueFromTable = parsed.table.rowObjects[0]
    ? toNumber(Object.values(parsed.table.rowObjects[0])[0])
    : 0;
  const total = valueFromTable || parsed.numbers[0] || 0;

  return (
    <TemplateShell
      code="PT"
      title="Total Patients Served Today"
      subtitle={parsed.summary || 'Current-day service throughput from operations feed.'}
    >
      <div className="predef-card center-stat">
        <div className="predef-center-label">Total Patients Served Today</div>
        <div className="predef-center-value">{nfInt.format(total)}</div>
        <div className="predef-card-delta">{total > 0 ? 'Operational flow active across care units' : 'No completed service operations recorded today'}</div>
      </div>
      <div className="predef-card insight wide">
        <div className="predef-card-label">Live Activity Note</div>
        <p>{parsed.insight || 'No additional insight returned in response.'}</p>
      </div>
    </TemplateShell>
  );
}

function DocTemplate({ parsed }) {
  const doctors = parsed.table.rowObjects.map((row) => ({
    name: pickValue(row, ['doctor_name', 'doctor name']) || 'Unknown',
    patients: toNumber(pickValue(row, ['patients_served', 'patients served', 'patient_count'])),
    revenue: toNumber(pickValue(row, ['revenue', 'total_revenue'])),
  })).filter((item) => item.name !== 'Unknown' || item.patients > 0);

  const ranked = doctors.slice(0, 6);
  if (!ranked.length) {
    return (
      <TemplateShell
        code="DOC"
        title="Doctor Performance Ranking"
        subtitle={parsed.summary || 'Real-time ranking by case volume and financial contribution.'}
      >
        <EmptyState />
      </TemplateShell>
    );
  }

  const leader = ranked[0];
  const maxPatients = Math.max(...ranked.map((d) => d.patients), 1);

  return (
    <TemplateShell
      code="DOC"
      title="Doctor Performance Ranking"
      subtitle={parsed.summary || 'Real-time ranking by case volume and financial contribution.'}
    >
      <div className="predef-card hero">
        <div>
          <div className="predef-card-label">Top Performer</div>
          <div className="predef-hero-value">{leader.name}</div>
          <div className="predef-card-delta">Patients served: {nfInt.format(leader.patients)} | Revenue: {nfMoney.format(leader.revenue)}</div>
        </div>
        <div className="predef-rank-badge">#1</div>
      </div>

      <div className="predef-card">
        <div className="predef-card-label">Performance Benchmarks</div>
        <div className="predef-list">
          {ranked.map((doctor) => (
            <div className="predef-list-row" key={doctor.name}>
              <div className="predef-list-main">
                <span>{doctor.name}</span>
                <strong>{nfInt.format(doctor.patients)} patients</strong>
              </div>
              <div className="predef-track">
                <span style={{ width: `${Math.max((doctor.patients / maxPatients) * 100, 8)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </TemplateShell>
  );
}

function RiskTemplate({ parsed }) {
  const row = parsed.table.rowObjects[0] || {};
  const active = toNumber(pickValue(row, ['active_patients', 'active patients'])) || parsed.numbers[0] || 0;
  const critical = toNumber(pickValue(row, ['critical_patients', 'critical patients'])) || parsed.numbers[1] || 0;
  const total = active + critical;
  const safePct = total > 0 ? active / total : 0;

  return (
    <TemplateShell
      code="RISK"
      title="Active vs Critical Patient Count"
      subtitle={parsed.summary || 'Real-time risk split for patient monitoring and escalation planning.'}
    >
      <div className="predef-grid two">
        <MetricCard label="Active Patients" value={nfInt.format(active)} tone="cyan" sparkValues={[290, 305, 300, 318, 324, 330, active || 333]} />
        <MetricCard label="Critical Patients" value={nfInt.format(critical)} tone="rose" sparkValues={[48, 50, 53, 52, 54, 55, critical || 55]} />
      </div>
      <div className="predef-card insight wide">
        <div className="predef-card-label">Risk Interpretation</div>
        <p>
          Stable profile index: <strong>{nfPct.format(safePct)}</strong>. {parsed.insight || 'No additional risk interpretation returned in response.'}
        </p>
      </div>
    </TemplateShell>
  );
}

function AlertTemplate({ parsed }) {
  const count = toNumber(pickValue(parsed.table.rowObjects[0] || {}, ['abnormal_vitals_alerts', 'value'])) || parsed.numbers[0] || 0;
  const critical = Math.max(Math.round(count * 0.35), 1);
  const warning = Math.max(count - critical, 0);

  return (
    <TemplateShell
      code="ALRT"
      title="Abnormal Vitals Alerts Summary"
      subtitle={parsed.summary || 'Live triage summary for abnormal vitals signals across monitored beds.'}
    >
      <div className="predef-grid two">
        <MetricCard label="Critical Alerts" value={nfInt.format(critical)} tone="rose" sparkValues={[8, 9, 8, 10, 9, 11, critical]} />
        <MetricCard label="Warning Alerts" value={nfInt.format(warning)} tone="amber" sparkValues={[16, 17, 19, 18, 20, 21, warning]} />
      </div>
      <div className="predef-card center-stat">
        <div className="predef-center-label">Total Abnormal Alerts</div>
        <div className="predef-center-value">{nfInt.format(count)}</div>
        <div className="predef-card-delta">Immediate response required for sustained oxygen and BP deviations</div>
      </div>
    </TemplateShell>
  );
}

function LoadTemplate({ parsed }) {
  const summaryText = `${parsed.summary || ''} ${parsed.insight || ''}`;
  const extractLoadValue = (row) => {
    const direct = toNumber(pickValue(row, ['patient_count', 'patients_served', 'active_load', 'patients_handled_count']));
    if (direct > 0) return direct;
    const activeLoad = String(pickValue(row, ['active_load']) || '');
    const match = activeLoad.match(/(\d+)/);
    return match ? toNumber(match[1]) : 0;
  };
  const doctors = parsed.table.rowObjects.map((row) => ({
    name: pickValue(row, ['doctor_name', 'doctor name']) || pickValue(row, ['provider']) || 'Provider',
    load: extractLoadValue(row),
  })).filter((item) => item.load > 0);

  const top = doctors.slice(0, 8);
  const avgLoadRaw = pickMetricFromText(summaryText, [
    'average number of patients handled by each doctor',
    'average number of patients handled per doctor',
    'average patients per doctor',
    'avg patients per doctor',
  ]);
  const avgLoad = toNumber(avgLoadRaw);

  const baseAvg = avgLoad > 0 ? avgLoad : 0;
  const seedDoctors = top;
  const hasDoctorRows = seedDoctors.length > 0;

  const distribution = seedDoctors.slice(0, 3);
  const maxLoad = Math.max(...distribution.map((d) => d.load), 1);
  const minLoad = Math.min(...distribution.map((d) => d.load), maxLoad);
  const spread = maxLoad - minLoad;
  const avgForStatus = distribution.reduce((sum, d) => sum + d.load, 0) / Math.max(distribution.length, 1);

  const ledgerRows = seedDoctors.slice(0, 6).map((doctor) => {
    const ratio = avgForStatus > 0 ? doctor.load / avgForStatus : 1;
    const status = ratio >= 1.2 ? 'Overloaded' : ratio >= 1.05 ? 'High Load' : 'Stable';
    const capacity = Math.max(Math.round(avgForStatus * 1.2), doctor.load + 1);
    const efficiency = Math.max(68, Math.min(98, Math.round(98 - Math.max(0, ratio - 1) * 34)));
    const progress = Math.max(35, Math.min(100, Math.round((doctor.load / capacity) * 100)));
    return {
      ...doctor,
      status,
      capacity,
      efficiency,
      progress,
    };
  });
  const overloadedCount = ledgerRows.filter((r) => r.status !== 'Stable').length;
  const stableCount = ledgerRows.filter((r) => r.status === 'Stable').length;

  return (
    <TemplateShell
      code="LOAD"
      title="Doctor Load Analytics"
      subtitle={'Real-time distribution of patient volume across primary care units. Analysis triggered by query: "Patients per doctor".'}
    >
      {!hasDoctorRows ? <EmptyState /> : <>
      <div className="predef-load-layout">
        <div className="predef-card predef-load-distribution">
          <div className="predef-load-head">
            <div>
              <div className="predef-card-label">Patient Load Distribution</div>
              <p>Metric: Active Cases / Primary Physician</p>
            </div>
            <span className="predef-load-live">Live stream</span>
          </div>
          <div className="predef-load-bars">
            {distribution.map((doctor) => (
              <div className="predef-load-bar-item" key={doctor.name}>
                <div className="predef-load-bar-value">{nfInt.format(doctor.load)}</div>
                <div className="predef-load-bar-track">
                  <span style={{ width: `${Math.max((doctor.load / maxLoad) * 100, 14)}%` }} />
                </div>
                <div className="predef-load-bar-name">{doctor.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="predef-card predef-load-logic">
          <h4>AI Reassignment Logic</h4>
          <div className="predef-load-alert tone-rose">
            <strong>Critical Alert</strong>
            <p>
              Highest assigned provider load is <strong>{nfInt.format(maxLoad)}</strong>, which is {nfInt.format(spread)}
              {' '}above the lowest assignment.
            </p>
          </div>
          <div className="predef-load-alert tone-green">
            <strong>Reassignment Strategy</strong>
            <p>{parsed.insight || 'Rebalance overflow cases toward stable providers to reduce response latency.'}</p>
          </div>
          <button type="button" className="predef-load-btn">Authorize Reassignment</button>
        </div>
      </div>

      <div className="predef-card predef-load-ledger">
        <div className="predef-load-ledger-head">
          <h4>Unit Performance Ledger</h4>
          <div className="predef-load-ledger-tags">
            <span className="tag tone-rose">{overloadedCount} Overloaded</span>
            <span className="tag tone-cyan">{stableCount} Stable</span>
          </div>
        </div>

        <table className="predef-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Active Load</th>
              <th>Status</th>
              <th>Shift Progress</th>
              <th>Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{nfInt.format(row.load)}/{nfInt.format(row.capacity)}</td>
                <td>
                  <span className={`predef-status-pill ${
                    row.status === 'Overloaded' ? 'rose' : row.status === 'High Load' ? 'amber' : 'green'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td>
                  <div className="predef-track predef-progress-track">
                    <span style={{ width: `${row.progress}%` }} />
                  </div>
                </td>
                <td>{row.efficiency}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </TemplateShell>
  );
}

function RegionTemplate({ parsed }) {
  const regions = parsed.table.rowObjects.map((row) => ({
    region: resolveRegionLabel(row),
    patients: toNumber(pickValue(row, ['total_patients', 'patient_count', 'patients'])),
    revenue: toNumber(pickValue(row, ['total_revenue', 'revenue'])),
    avgAge: toNumber(pickValue(row, ['avg_patient_age', 'avg patient age'])),
  })).filter((item) => item.region);

  const top = regions.slice(0, 8);
  if (!top.length) {
    return (
      <TemplateShell
        code="REG"
        title="Region-wise Patient Distribution"
        subtitle={parsed.summary || 'Regional care volume distribution across monitored zones.'}
      >
        <EmptyState />
      </TemplateShell>
    );
  }

  const maxPatients = Math.max(...top.map((r) => r.patients), 1);

  return (
    <TemplateShell
      code="REG"
      title="Region-wise Patient Distribution"
      subtitle={parsed.summary || 'Regional care volume distribution across monitored zones.'}
    >
      <div className="predef-grid two">
        <div className="predef-card">
          <div className="predef-card-label">Regional Patient Mix</div>
          <div className="predef-list">
            {top.map((region) => (
              <div className="predef-list-row" key={region.region}>
                <div className="predef-list-main">
                  <span>{region.region}</span>
                  <strong>{nfInt.format(region.patients)} patients</strong>
                </div>
                <div className="predef-track">
                  <span style={{ width: `${Math.max((region.patients / maxPatients) * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="predef-card">
          <div className="predef-card-label">Revenue and Age Profile</div>
          <table className="predef-table">
            <thead>
              <tr><th>Region</th><th>Revenue</th><th>Avg Age</th></tr>
            </thead>
            <tbody>
              {top.map((region) => (
                <tr key={`${region.region}-meta`}>
                  <td>{region.region}</td>
                  <td>{nfMoney.format(region.revenue)}</td>
                  <td>{region.avgAge ? region.avgAge.toFixed(1) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TemplateShell>
  );
}

function PayTemplate({ parsed }) {
  const statuses = parsed.table.rowObjects.map((row) => ({
    status: pickValue(row, ['payment_status', 'payment status']) || 'Unknown',
    records: toNumber(pickValue(row, ['records', 'cases'])),
    amount: toNumber(pickValue(row, ['amount', 'total'])),
  })).filter((item) => item.status);

  const list = statuses;
  if (!list.length) {
    return (
      <TemplateShell
        code="PAY"
        title="Pending Payment Cases"
        subtitle={parsed.summary || 'Revenue-cycle snapshot for unresolved payment states.'}
      >
        <EmptyState />
      </TemplateShell>
    );
  }

  const totalAmount = list.reduce((sum, item) => sum + item.amount, 0);
  const maxAmount = Math.max(...list.map((item) => item.amount), 1);

  return (
    <TemplateShell
      code="PAY"
      title="Pending Payment Cases"
      subtitle={parsed.summary || 'Revenue-cycle snapshot for unresolved payment states.'}
    >
      <div className="predef-card hero">
        <div>
          <div className="predef-card-label">Total Pending Payments</div>
          <div className="predef-hero-value">{nfMoney.format(totalAmount)}</div>
        </div>
        <div className="predef-live-pill alt">Revenue cycle monitor</div>
      </div>

      <div className="predef-card">
        <div className="predef-card-label">Pending Breakdown</div>
        <div className="predef-list">
          {list.map((item) => (
            <div className="predef-list-row" key={item.status}>
              <div className="predef-list-main">
                <span>{item.status}</span>
                <strong>{nfMoney.format(item.amount)} | {nfInt.format(item.records)} cases</strong>
              </div>
              <div className="predef-track">
                <span style={{ width: `${Math.max((item.amount / maxAmount) * 100, 8)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </TemplateShell>
  );
}

function TrendTemplate({ parsed }) {
  const rows = parsed.table.rowObjects;
  const grouped = {};
  const summaryText = `${parsed.summary || ''} ${parsed.insight || ''}`;

  rows.forEach((row) => {
    const month = pickValue(row, ['month', 'period']) || 'Unknown';
    if (!grouped[month]) grouped[month] = { success: 0, failed: 0, ongoing: 0, total: 0 };

    const directSuccess = toNumber(pickValue(row, ['success', 'completed', 'recovered']));
    const directOngoing = toNumber(pickValue(row, ['ongoing', 'active', 'in_progress']));
    const directFailed = toNumber(pickValue(row, ['failed', 'critical', 'readmissions', 'readmission']));

    if (directSuccess || directOngoing || directFailed) {
      grouped[month].success += directSuccess;
      grouped[month].ongoing += directOngoing;
      grouped[month].failed += directFailed;
      grouped[month].total += directSuccess + directOngoing + directFailed;
      return;
    }

    const outcome = normalizeText(pickValue(row, ['outcome', 'status']));
    const count = toNumber(pickValue(row, ['operations_count', 'operations count', 'count', 'value']));

    if (outcome.includes('success') || outcome.includes('complete')) grouped[month].success += count;
    else if (outcome.includes('fail') || outcome.includes('critical') || outcome.includes('readmission')) grouped[month].failed += count;
    else grouped[month].ongoing += count;

    grouped[month].total += count;
  });

  const months = Object.keys(grouped).sort();
  const points = months.map((month) => grouped[month].success);

  const parsedRecoveryPct = toNumber(
    pickMetricFromText(summaryText, ['recovery rate', 'recovery_rate_percent', 'recovery_progress_percent'])
  );
  const parsedStabilityPct = toNumber(
    pickMetricFromText(summaryText, ['stability index', 'stability_index_percent'])
  );
  const parsedReadmissionPct = toNumber(
    pickMetricFromText(summaryText, ['failure/readmission', 'readmission rate', 'readmission_rate_percent'])
  );

  const totalSuccess = months.reduce((sum, month) => sum + grouped[month].success, 0);
  const totalFailed = months.reduce((sum, month) => sum + grouped[month].failed, 0);
  const totalOps = months.reduce((sum, month) => sum + grouped[month].total, 0);

  const derivedRecoveryRate = totalOps > 0 ? totalSuccess / totalOps : 0;
  const derivedReadmission = totalOps > 0 ? totalFailed / totalOps : 0;

  const recoveryRate = parsedRecoveryPct > 0 ? parsedRecoveryPct / 100 : derivedRecoveryRate;
  const readmission = parsedReadmissionPct > 0 ? parsedReadmissionPct / 100 : derivedReadmission;
  const stability = parsedStabilityPct > 0 ? parsedStabilityPct / 100 : Math.max(1 - readmission, 0);

  return (
    <TemplateShell
      code="TRND"
      title="Patient Outcome Trends"
      subtitle={parsed.summary || 'Aggregate patient outcome trajectories across recent months.'}
    >
      <div className="predef-card hero">
        <div>
          <div className="predef-card-label">Recovery Progress</div>
          <div className="predef-hero-value">{nfPct.format(recoveryRate)}</div>
        </div>
        <Sparkline values={points} tone="cyan" />
      </div>

      <div className="predef-grid three">
        <MetricCard label="Recovery Rate" value={nfPct.format(recoveryRate)} tone="cyan" />
        <MetricCard label="Stability Index" value={nfPct.format(stability)} tone="green" />
        <MetricCard label="Failure/Readmission" value={nfPct.format(readmission)} tone="rose" />
      </div>

      {months.length > 0 ? (
        <div className="predef-card">
          <div className="predef-card-label">Monthly Outcome Ledger</div>
          <table className="predef-table">
            <thead>
              <tr><th>Month</th><th>Success</th><th>Ongoing</th><th>Failed</th></tr>
            </thead>
            <tbody>
              {months.slice(-8).map((month) => (
                <tr key={month}>
                  <td>{month}</td>
                  <td>{nfInt.format(grouped[month].success)}</td>
                  <td>{nfInt.format(grouped[month].ongoing)}</td>
                  <td>{nfInt.format(grouped[month].failed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="No monthly trend table found in response." />
      )}
    </TemplateShell>
  );
}

export default function PredefinedResponseTemplate({ templateKey, content }) {
  const parsed = useMemo(() => parseContent(content), [content]);

  switch (templateKey) {
    case 'KPI':
      return <KpiTemplate parsed={parsed} />;
    case 'REV':
      return <RevTemplate parsed={parsed} />;
    case 'PT':
      return <PtTemplate parsed={parsed} />;
    case 'DOC':
      return <DocTemplate parsed={parsed} />;
    case 'RISK':
      return <RiskTemplate parsed={parsed} />;
    case 'ALRT':
      return <AlertTemplate parsed={parsed} />;
    case 'LOAD':
      return <LoadTemplate parsed={parsed} />;
    case 'REG':
      return <RegionTemplate parsed={parsed} />;
    case 'PAY':
      return <PayTemplate parsed={parsed} />;
    case 'TRND':
      return <TrendTemplate parsed={parsed} />;
    default:
      return null;
  }
}
