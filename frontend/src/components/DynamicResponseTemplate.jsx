import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DynamicResponseTemplate.css';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPipeRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => String(cell || '').replace(/\*\*/g, '').trim());
}

function isPipeLikeRow(line) {
  const s = String(line || '').trim();
  if (!s || !s.includes('|')) return false;
  return s.replace(/^\|/, '').replace(/\|$/, '').split('|').length >= 2;
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
  if (startIndex === -1) return { headers: [], rows: [], startIndex: -1, endIndex: -1 };
  let endIndex = startIndex + 2;
  while (endIndex < lines.length && isPipeLikeRow(lines[endIndex].trim())) endIndex += 1;
  const tableLines = lines.slice(startIndex, endIndex).map((line) => line.trim());
  const headers = splitPipeRow(tableLines[0]);
  const rows = [];
  for (let i = 2; i < tableLines.length; i += 1) {
    const cells = splitPipeRow(tableLines[i]);
    if (!cells.some(Boolean)) continue;
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }
  return { headers, rows, startIndex, endIndex };
}

function parseLooseTable(content) {
  const lines = String(content || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [], startIndex: -1, endIndex: -1 };

  let start = lines.findIndex((l) => normalizeText(l) === 'data table');
  if (start === -1) {
    start = lines.findIndex((l) => /\t/.test(l) || /\s{2,}/.test(l));
  } else {
    start += 1;
  }
  if (start < 0 || start >= lines.length) return { headers: [], rows: [], startIndex: -1, endIndex: -1 };

  const block = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    const n = normalizeText(line);
    if (n.startsWith('insight') || n.startsWith('visual diagram') || n.startsWith('summary')) break;
    if (!/\t/.test(line) && !/\s{2,}/.test(line)) continue;
    block.push(line);
  }
  if (block.length < 2) return { headers: [], rows: [], startIndex: -1, endIndex: -1 };

  const splitRow = (line) => line.split(/\t+|\s{2,}/).map((x) => x.trim()).filter(Boolean);
  const headers = splitRow(block[0]);
  if (headers.length < 2) return { headers: [], rows: [], startIndex: -1, endIndex: -1 };
  const rows = [];
  for (let i = 1; i < block.length; i += 1) {
    const cells = splitRow(block[i]);
    if (!cells.length) continue;
    if (cells.every((c) => c === '...' || c === '-')) continue;
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }
  return rows.length ? { headers, rows, startIndex: 0, endIndex: rows.length + 1 } : { headers: [], rows: [], startIndex: -1, endIndex: -1 };
}

function toNumber(value) {
  const cleaned = String(value || '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return NaN;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function extractMetrics(content) {
  const text = String(content || '');
  const metricRegex = /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?([A-Za-z][A-Za-z \/%()-]{2,40})(?:\*\*)?\s*[:=-]\s*([^\n|]{1,240})/g;
  const metrics = [];
  let match = metricRegex.exec(text);
  while (match && metrics.length < 4) {
    metrics.push({ label: match[1].trim(), value: match[2].trim() });
    match = metricRegex.exec(text);
  }
  return metrics;
}

function cleanupSectionText(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeSummaryMarkdown(text) {
  const raw = String(text || '');
  if (!raw) return '';
  let out = raw;
  out = out.replace(/\bDATA OPTIONS\b/gi, '\n\n### Data Options\n\n');
  out = out.replace(/Here are some possible[^.]*\./gi, '');

  // Convert inline pipe-style content into proper markdown table lines.
  const pipeMatch = out.match(/\|\s*Data Option\s*\|\s*Description\s*\|[\s\S]*$/i);
  if (pipeMatch) {
    const pipeBlock = pipeMatch[0];
    const cells = pipeBlock
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c) => c !== '---');

    const tableLines = [];
    if (cells.length >= 2) {
      tableLines.push(`| ${cells[0]} | ${cells[1]} |`);
      tableLines.push('| --- | --- |');
      for (let i = 2; i < cells.length; i += 2) {
        const c1 = cells[i] || '';
        const c2 = cells[i + 1] || '';
        if (!c1 && !c2) continue;
        tableLines.push(`| ${c1} | ${c2} |`);
      }
      out = out.replace(pipeBlock, `\n\n${tableLines.join('\n')}`);
    }
  }

  // Remove duplicate headings if model repeated them.
  out = out.replace(/(?:\n\s*###\s*Data Options\s*){2,}/gi, '\n\n### Data Options\n\n');
  out = out.replace(/(?:\n\s*DATA OPTIONS\s*){2,}/gi, '\n\n### Data Options\n\n');

  // Make sentence boundaries readable when model sends long inline text.
  out = out.replace(/\. (?=[A-Z])/g, '.\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function parseNarrativeSections(text, table) {
  const full = String(text || '');
  const upper = full.toUpperCase();
  const summaryIdx = upper.indexOf('SUMMARY');
  const insightsIdx = upper.indexOf('INSIGHTS');
  const visualIdx = upper.indexOf('VISUAL DIAGRAM');
  const dataTableIdx = upper.indexOf('DATA TABLE');
  const endGuard = [dataTableIdx, visualIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? full.length;

  let summary = '';
  let insights = '';
  if (summaryIdx >= 0) {
    const summaryEnd = [insightsIdx, endGuard].filter((i) => i > summaryIdx).sort((a, b) => a - b)[0] ?? full.length;
    summary = cleanupSectionText(full.slice(summaryIdx + 'SUMMARY'.length, summaryEnd).replace(/^[:\s-]+/, ''));
  }
  if (insightsIdx >= 0) {
    const insightsEnd = [visualIdx].filter((i) => i > insightsIdx).sort((a, b) => a - b)[0] ?? full.length;
    insights = cleanupSectionText(full.slice(insightsIdx + 'INSIGHTS'.length, insightsEnd).replace(/^[:\s-]+/, ''));
  }

  if (!summary && table.startIndex !== -1) {
    const lines = full.split(/\r?\n/);
    summary = cleanupSectionText(lines.slice(0, table.startIndex).join(' '));
  }
  if (!insights && table.startIndex !== -1) {
    const lines = full.split(/\r?\n/);
    insights = cleanupSectionText(lines.slice(table.endIndex).join(' '));
  }

  if (!summary && !insights) {
    summary = cleanupSectionText(full);
  }
  return { summary, insights };
}

function RichInlineText({ text }) {
  const source = String(text || '');
  const parts = source.split(/('(?:[^']+)'|"(?:[^"]+)"|\b\d+(?:\.\d+)?\b)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        const isQuoted = /^['"].*['"]$/.test(part);
        const isNumber = /^\d+(\.\d+)?$/.test(part);
        if (isQuoted || isNumber) {
          return <span key={`t-${idx}`} className="dyn-inline-accent">{part}</span>;
        }
        return <span key={`t-${idx}`}>{part}</span>;
      })}
    </>
  );
}

function inferIntent(query, content) {
  const source = normalizeText(`${query || ''} ${content || ''}`);
  if (/revenue|billing|payment|cost|profit/.test(source)) return 'Financial Summary';
  if (/risk|critical|alert|abnormal|escalation/.test(source)) return 'Risk Snapshot';
  if (/trend|month|weekly|growth|decline/.test(source)) return 'Trend Analysis';
  if (/doctor|patient|load|service|region|distribution/.test(source)) return 'Operations Overview';
  return 'Dynamic Insight';
}

function preferredChartFromQuery(query) {
  const q = normalizeText(query || '');
  if (!q) return null;
  if (q.includes('column chart') || q.includes('bar chart') || q.includes('column graph') || q.includes('bar graph')) {
    return 'bar';
  }
  if (q.includes('line chart') || q.includes('line graph')) return 'line';
  if (q.includes('area chart') || q.includes('area graph')) return 'line';
  if (q.includes('pie chart') || q.includes('donut chart') || q.includes('doughnut chart')) return 'pie';
  return null;
}

function inferSeries(table, query) {
  if (!table?.headers?.length || !table?.rows?.length) return null;
  const headers = table.headers;
  const rows = table.rows;
  const numericColumnIndexes = headers
    .map((_, idx) => idx)
    .filter((idx) => rows.some((row) => Number.isFinite(toNumber(row[idx]))));
  if (!numericColumnIndexes.length) return null;

  const labelIndex = headers
    .map((_, idx) => idx)
    .find((idx) => !numericColumnIndexes.includes(idx)) ?? 0;
  const preferred = preferredChartFromQuery(query);
  const minPoints = preferred === 'bar' || preferred === 'pie' ? 2 : 3;
  const candidateSeries = numericColumnIndexes.map((colIdx) => {
    const points = rows
      .map((row) => {
        const label = String(row[labelIndex] || '').trim();
        const value = toNumber(row[colIdx]);
        return { label, value };
      })
      .filter((p) => p.label && Number.isFinite(p.value));
    if (points.length < minPoints) return null;
    const values = points.map((p) => p.value);
    const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(values.length, 1);
    return { colIdx, points, variance };
  }).filter(Boolean);

  if (!candidateSeries.length) return null;
  candidateSeries.sort((a, b) => b.variance - a.variance);
  const best = candidateSeries[0];
  const points = best.points;
  const selectedNumeric = best.colIdx;

  const labelHeader = headers[labelIndex] || 'Label';
  const valueHeader = headers[selectedNumeric] || 'Value';
  const normalizedLabel = normalizeText(labelHeader);
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0);
  const flatness = span / Math.max(Math.abs(max), 1);
  const isMostlyFlat = flatness < 0.04;
  const chartType = /month|week|day|date|year|quarter|time|period/.test(normalizedLabel)
    ? 'line'
    : points.length <= 6
      ? 'pie'
      : 'bar';
  const resolvedChartType = preferred || chartType;

  return { chartType: resolvedChartType, points, labelHeader, valueHeader, min, max, span, isMostlyFlat };
}

function axisTicks(min, max, count = 4) {
  const span = Math.max(max - min, 1);
  return Array.from({ length: count + 1 }).map((_, i) => min + (span * i) / count);
}

function formatTick(value) {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${Math.round(value * 100) / 100}`;
}

function LineChart({ points, min, max, valueHeader, labelHeader }) {
  const w = 720;
  const h = 240;
  const leftPad = 54;
  const rightPad = 20;
  const topPad = 16;
  const bottomPad = 34;
  const values = points.map((p) => p.value);
  const localMin = Number.isFinite(min) ? min : Math.min(...values);
  const localMax = Number.isFinite(max) ? max : Math.max(...values);
  const span = Math.max(localMax - localMin, 1);
  const ticks = axisTicks(localMin, localMax, 4);
  const mapped = points.map((p, i) => {
    const x = leftPad + (i * (w - leftPad - rightPad)) / Math.max(points.length - 1, 1);
    const y = h - bottomPad - ((p.value - localMin) / span) * (h - topPad - bottomPad);
    return { ...p, x, y };
  });
  const linePoints = mapped.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${leftPad},${h - bottomPad} ${linePoints} ${w - rightPad},${h - bottomPad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dyn-chart-svg">
      <text className="dyn-chart-axis-title" x={leftPad} y={12}>{valueHeader}</text>
      <text className="dyn-chart-axis-title" x={w - rightPad} y={h - 8} textAnchor="end">{labelHeader}</text>
      {ticks.map((tick) => {
        const y = h - bottomPad - ((tick - localMin) / span) * (h - topPad - bottomPad);
        return (
          <g key={`tick-${tick}`}>
            <line className="dyn-grid-line" x1={leftPad} y1={y} x2={w - rightPad} y2={y} />
            <text className="dyn-chart-ylabel" x={leftPad - 8} y={y + 3} textAnchor="end">{formatTick(tick)}</text>
          </g>
        );
      })}
      <polygon className="dyn-chart-area" points={area} />
      <polyline className="dyn-chart-line" points={linePoints} />
      {mapped.map((p) => (
        <g key={`pt-${p.label}`}>
          <circle className="dyn-chart-dot" cx={p.x} cy={p.y} r="3.5" />
          <text className="dyn-chart-xlabel" x={p.x} y={h - 6} textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function BarChart({ points, min, max, valueHeader, labelHeader }) {
  const w = 720;
  const h = 260;
  const leftPad = 54;
  const rightPad = 20;
  const topPad = 16;
  const bottomPad = 34;
  const values = points.map((p) => p.value);
  const localMin = Number.isFinite(min) ? Math.min(0, min) : 0;
  const localMax = Number.isFinite(max) ? Math.max(max, 1) : Math.max(...values, 1);
  const span = Math.max(localMax - localMin, 1);
  const ticks = axisTicks(localMin, localMax, 4);
  const barW = (w - leftPad - rightPad) / points.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="dyn-chart-svg">
      <text className="dyn-chart-axis-title" x={leftPad} y={12}>{valueHeader}</text>
      <text className="dyn-chart-axis-title" x={w - rightPad} y={h - 8} textAnchor="end">{labelHeader}</text>
      {ticks.map((tick) => {
        const y = h - bottomPad - ((tick - localMin) / span) * (h - topPad - bottomPad);
        return (
          <g key={`tick-${tick}`}>
            <line className="dyn-grid-line" x1={leftPad} y1={y} x2={w - rightPad} y2={y} />
            <text className="dyn-chart-ylabel" x={leftPad - 8} y={y + 3} textAnchor="end">{formatTick(tick)}</text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const height = ((h - topPad - bottomPad) * (p.value - localMin)) / span;
        const x = leftPad + i * barW + 6;
        const y = h - bottomPad - height;
        return (
          <g key={`bar-${p.label}`}>
            <rect className="dyn-chart-bar" x={x} y={y} width={Math.max(barW - 12, 8)} height={height} rx="6" />
            <text className="dyn-chart-xlabel" x={x + Math.max(barW - 12, 8) / 2} y={h - 6} textAnchor="middle">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ points }) {
  const total = points.reduce((acc, p) => acc + p.value, 0) || 1;
  const cx = 110;
  const cy = 110;
  const r = 88;
  const palette = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4'];
  let angle = -Math.PI / 2;

  const slices = points.map((p, i) => {
    const portion = p.value / total;
    const sweep = portion * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle += sweep;
    return { d, color: palette[i % palette.length], label: p.label, value: p.value };
  });

  return (
    <div className="dyn-pie-wrap">
      <svg viewBox="0 0 220 220" className="dyn-pie-svg">
        {slices.map((s) => <path key={s.label} d={s.d} fill={s.color} className="dyn-pie-slice" />)}
      </svg>
      <div className="dyn-pie-legend">
        {slices.map((s) => (
          <div className="dyn-pie-item" key={`leg-${s.label}`}>
            <span className="dyn-pie-dot" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
            <strong>{Math.round((s.value / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartBlock({ series }) {
  if (!series) return null;
  return (
    <section className="dyn-chart-shell" aria-label="Auto generated chart">
      <div className="dyn-chart-head">
        <h4>Chart View</h4>
        <span>{series.valueHeader} by {series.labelHeader}</span>
      </div>
      {series.isMostlyFlat && <div className="dyn-flat-note">Low variance detected in this series; trend may look near-flat.</div>}
      {series.chartType === 'line' && (
        <LineChart
          points={series.points}
          min={series.min}
          max={series.max}
          valueHeader={series.valueHeader}
          labelHeader={series.labelHeader}
        />
      )}
      {series.chartType === 'bar' && (
        <BarChart
          points={series.points}
          min={series.min}
          max={series.max}
          valueHeader={series.valueHeader}
          labelHeader={series.labelHeader}
        />
      )}
      {series.chartType === 'pie' && <PieChart points={series.points} />}
    </section>
  );
}

function TableBlock({ table }) {
  if (!table.headers.length || !table.rows.length) return null;
  return (
    <div className="dyn-table-wrap">
      <table className="dyn-table">
        <thead>
          <tr>
            {table.headers.map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 12).map((row, idx) => (
            <tr key={`r-${idx}`}>
              {row.map((c, cidx) => <td key={`c-${idx}-${cidx}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DynamicResponseTemplate({ content, query }) {
  const parsed = useMemo(() => {
    const text = String(content || '').trim();
    const markdownTable = parseMarkdownTable(text);
    const table = markdownTable.headers.length ? markdownTable : parseLooseTable(text);
    const narrative = parseNarrativeSections(text, table);
    return {
      intent: inferIntent(query, text),
      metrics: extractMetrics(text),
      table,
      series: inferSeries(table, query),
      summary: narrative.summary,
      insights: narrative.insights,
    };
  }, [content, query]);

  return (
    <section className="dyn-shell">
      <header className="dyn-head">
        <div>
          <div className="dyn-chip">DYN</div>
          <h3>{parsed.intent}</h3>
          <p>{query || 'Generated from live prompt context'}</p>
        </div>
      </header>
      {parsed.metrics.length > 0 && (
        <div className="dyn-grid">
          {parsed.metrics.map((m) => (
            <article className="dyn-card" key={m.label}>
              <div className="dyn-label">{m.label}</div>
              <div className="dyn-value">{m.value}</div>
            </article>
          ))}
        </div>
      )}
      {parsed.summary && (
        <section className="dyn-note-pill" aria-label="Summary">
          <div className="dyn-note-title">Summary:</div>
          <div className="dyn-note-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="dyn-summary-table-wrap">
                    <table {...props} />
                  </div>
                ),
              }}
            >
              {normalizeSummaryMarkdown(parsed.summary)}
            </ReactMarkdown>
          </div>
        </section>
      )}
      <ChartBlock series={parsed.series} />
      <TableBlock table={parsed.table} />
      {parsed.insights && (
        <section className="dyn-insights-card" aria-label="Insights">
          <h4>Insights</h4>
          <p><RichInlineText text={parsed.insights} /></p>
        </section>
      )}
    </section>
  );
}
