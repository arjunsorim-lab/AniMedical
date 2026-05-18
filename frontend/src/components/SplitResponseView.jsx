import { useMemo, useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import {
  HiOutlineChevronDown,
  HiOutlineRefresh,
  HiOutlineSwitchHorizontal,
  HiOutlineCheckCircle,
  HiOutlineChartBar,
  HiOutlineCollection,
  HiOutlineDocumentText,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
} from 'react-icons/hi';
import './SplitResponseView.css';

/* ─── Extraction Utilities ─── */
function extractJsonBlock(content) {
  const raw = String(content || '');
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const sectionTwoStart = raw.search(/SECTION 2\s*[—-]\s*VISUAL DASHBOARD RESPONSE/i);
  const sectionText = sectionTwoStart >= 0 ? raw.slice(sectionTwoStart) : raw;
  const firstBrace = sectionText.indexOf('{');
  const lastBrace = sectionText.lastIndexOf('}');
  const jsonText = fencedMatch?.[1] || (
    firstBrace >= 0 && lastBrace > firstBrace
      ? sectionText.slice(firstBrace, lastBrace + 1)
      : null
  );
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function extractTextSection(content) {
  const raw = String(content || '');
  const sectionOneStart = raw.search(/SECTION 1\s*[—-]\s*TEXT SUMMARY RESPONSE/i);
  const sectionTwoStart = raw.search(/SECTION 2\s*[—-]\s*VISUAL DASHBOARD RESPONSE/i);
  const start = sectionOneStart >= 0 ? sectionOneStart : 0;
  const end = sectionTwoStart >= 0 ? sectionTwoStart : raw.length;

  return raw
    .slice(start, end)
    .replace(/=+/g, '')
    .replace(/SECTION 1\s*[—-]\s*TEXT SUMMARY RESPONSE/i, '')
    .trim();
}

function metricIcon(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'positive' || normalized === 'low') return '📈';
  if (normalized === 'negative' || normalized === 'high') return '📉';
  return '•';
}

function alertIcon(severity) {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'high') return '🔴';
  if (normalized === 'medium') return '🟡';
  return '🟢';
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'positive' || normalized === 'low') return 'positive';
  if (normalized === 'negative' || normalized === 'high') return 'negative';
  if (normalized === 'medium') return 'warning';
  return 'neutral';
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function buildDashboardNarrative(dashboard, fallbackText) {
  const backendText = String(fallbackText || '').trim();
  if (
    backendText &&
    /Executive Summary/i.test(backendText) &&
    /Actionable Next Steps/i.test(backendText)
  ) {
    return backendText;
  }

  if (!dashboard) return backendText;

  const title = dashboard.dashboard_title || 'Healthcare Analytics Dashboard';
  const metrics = dashboard.summary_metrics || [];
  const rankings = dashboard.rankings || [];
  const alerts = dashboard.alerts || [];
  const insights = dashboard.insights || [];
  const recommendations = dashboard.recommendations || [];
  const top = dashboard.top_performer || {};
  const topName = top.name || rankings[0]?.name || 'N/A';
  const topScore = top.score || rankings[0]?.score || 'N/A';
  const lowestName = rankings[rankings.length - 1]?.name || 'N/A';

  const metricLines = metrics.length
    ? metrics.slice(0, 6).map((metric) => (
      `- ${metricIcon(metric.status)} **${metric.label || 'Metric'}**: ${formatValue(metric.value)}`
    ))
    : ['- • **Metrics**: No KPI rows were available in the dashboard payload.'];

  const alertLines = alerts.length
    ? alerts.map((alert) => (
      `${alertIcon(alert.severity)} **[${String(alert.severity || 'info').toUpperCase()}]** ${alert.message || 'Review dashboard alert.'}`
    ))
    : ['🟢 **[CLEAR]** No high-severity alert was generated from the available dashboard data.'];

  const insightLines = insights.length
    ? insights.map((item) => `- ${item}`)
    : ['- Dashboard metrics are generated from available healthcare data.'];

  const rankingLines = rankings.length
    ? rankings.slice(0, 8).map((item, index) => {
      const meta = item.additional_metrics || {};
      const detail = [
        Number(meta.patients_served) > 0 ? `${meta.patients_served} patients` : '',
        Number(meta.efficiency) > 0 ? `${meta.efficiency}% efficiency` : '',
      ].filter(Boolean).join(', ');
      return `${index + 1}. **${item.name || `Item ${index + 1}`}** — Score: **${formatValue(item.score)}**${detail ? ` (${detail})` : ''}`;
    })
    : ['No ranked rows were available for this prompt.'];

  const recommendationLines = [
    recommendations[0] || 'Review the dashboard metrics and prioritize operational follow-up.',
    'Resolve any red or amber alert items first, then validate operational impact with the responsible team.',
    `Compare ${topName} against lower-ranked segments to identify repeatable practices or workflow gaps.`,
    'Refresh this report on a regular cadence and compare KPI movement before committing changes.',
  ].map((item, index) => `${index + 1}. **${index === 0 ? 'Primary Action' : ['Risk Control', 'Performance Improvement', 'Dashboard Governance'][index - 1]}**: ${item}`);

  return [
    '## Executive Summary',
    `${title} generated from available healthcare analytics data. This response includes a detailed narrative and a structured dashboard for visual review.`,
    '',
    '## Key Metrics',
    ...metricLines,
    '',
    '## Alerts & Critical Issues',
    ...alertLines,
    '',
    '## Analysis & Insights',
    `**Primary Focus**: ${title}`,
    '',
    `**Top Performer / Leading Segment**: ${topName} with dashboard score **${formatValue(topScore)}**.`,
    '',
    `**Lowest Ranked Visible Segment**: ${lowestName}.`,
    '',
    ...insightLines,
    '',
    '## Detailed Rankings',
    ...rankingLines,
    '',
    '## Strategic Recommendations',
    ...recommendationLines,
    '',
    '## Actionable Next Steps',
    '1. Review KPI cards and confirm whether each status matches source-system expectations.',
    '2. Inspect the top 8 rankings to isolate the strongest driver and weakest visible segment.',
    '3. Compare the bar, line, donut, and progress widgets for the same metric story.',
    '4. Assign follow-up ownership for each high or medium alert with a target resolution date.',
    '5. Re-run the same prompt after updates to measure KPI, ranking, and alert-count improvement.',
  ].join('\n');
}

/* ─── Shared Sub-components ─── */

function KpiCards({ metrics = [] }) {
  if (!metrics.length) return null;
  return (
    <div className="srv-kpi-grid">
      {metrics.map((metric, index) => (
        <div className={`srv-kpi-card ${statusClass(metric.status)}`} key={`${metric.label}-${index}`}>
          <span>{metric.label}</span>
          <strong>{formatValue(metric.value)}</strong>
          {metric.change ? <small>{metric.change}</small> : null}
        </div>
      ))}
    </div>
  );
}

function RiskIndicators({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="srv-risk-list">
      {alerts.map((alert, index) => (
        <div className={`srv-risk-item ${statusClass(alert.severity)}`} key={`${alert.severity}-${index}`}>
          <span className="srv-alert-badge">{alert.severity || 'neutral'}</span>
          <p>{alert.message}</p>
        </div>
      ))}
    </div>
  );
}

function RecommendationList({ recommendations = [] }) {
  if (!recommendations.length) return null;
  return (
    <ul className="srv-recommendations">
      {recommendations.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function ExpandableSection({ title, children, defaultOpen = false }) {
  return (
    <details className="srv-details" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <HiOutlineChevronDown />
      </summary>
      <div>{children}</div>
    </details>
  );
}

/* ─── 1. Dashboard View (Visual Progress/Interactive Layout) ─── */
function VisualRankings({ rankings = [] }) {
  if (!rankings.length) return null;
  const maxScore = Math.max(...rankings.map(r => parseFloat(r.score) || 1));
  return (
    <div className="srv-visual-rankings">
      {rankings.slice(0, 6).map((item, idx) => {
        const pct = Math.max(10, Math.min(100, Math.round((parseFloat(item.score) / maxScore) * 100)));
        return (
          <div className="srv-visual-rank-row" key={`${item.name}-${idx}`}>
            <div className="srv-rank-info">
              <span className="srv-rank-badge">#{idx + 1}</span>
              <span className="srv-rank-name">{item.name}</span>
              <span className="srv-rank-score">{formatValue(item.score)}</span>
            </div>
            <div className="srv-rank-progress-track">
              <div className="srv-rank-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardResponseView({ dashboard }) {
  if (!dashboard) return <EmptyState />;

  return (
    <div className="srv-structured srv-dashboard-mode">
      <div className="srv-dashboard-head">
        <div>
          <span className="srv-eyebrow">Interactive Panel</span>
          <h4>{dashboard.dashboard_title || 'Visual Dashboard'}</h4>
        </div>
        <time>{dashboard.generated_at || 'Real-time'}</time>
      </div>

      <KpiCards metrics={dashboard.summary_metrics || []} />

      {dashboard.top_performer?.name ? (
        <div className="srv-top-performer animate-fade-in">
          <span>👑 Leading Segment</span>
          <strong>{dashboard.top_performer.name}</strong>
          <p>Dashboard Score: <strong>{formatValue(dashboard.top_performer.score)}</strong></p>
        </div>
      ) : null}

      <div className="srv-dashboard-visuals">
        <ExpandableSection title="Metric Performance Spectrum" defaultOpen>
          <VisualRankings rankings={dashboard.rankings || []} />
        </ExpandableSection>

        <ExpandableSection title="Risk Indicators" defaultOpen>
          <RiskIndicators alerts={dashboard.alerts || []} />
        </ExpandableSection>

        <ExpandableSection title="AI Insights Analysis">
          <RecommendationList recommendations={dashboard.insights || []} />
        </ExpandableSection>
      </div>
    </div>
  );
}

/* ─── 2. Report View (Tabular Ledger & Strategic Actions) ─── */
function TabularLedger({ rankings = [] }) {
  if (!rankings.length) return null;
  return (
    <div className="srv-table-wrapper">
      <table className="srv-report-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Provider/Segment</th>
            <th style={{ textAlign: 'right' }}>Score</th>
            <th style={{ textAlign: 'right' }}>Patients Served</th>
            <th style={{ textAlign: 'right' }}>Efficiency</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((item, idx) => {
            const pct = parseFloat(item.additional_metrics?.efficiency) || 0;
            const status = pct >= 85 ? 'Overloaded' : pct >= 70 ? 'Moderate' : 'Stable';
            return (
              <tr key={`${item.name}-${idx}`}>
                <td><strong>#{idx + 1}</strong></td>
                <td className="td-name">{item.name}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatValue(item.score)}</td>
                <td style={{ textAlign: 'right' }}>{formatValue(item.additional_metrics?.patients_served)}</td>
                <td style={{ textAlign: 'right' }}>
                  {item.additional_metrics?.efficiency ? `${item.additional_metrics.efficiency}%` : '—'}
                </td>
                <td>
                  <span className={`predef-status-pill ${
                    status === 'Overloaded' ? 'rose' : status === 'Moderate' ? 'amber' : 'green'
                  }`}>
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportResponseView({ dashboard }) {
  if (!dashboard) return <EmptyState />;

  return (
    <div className="srv-structured srv-report-mode">
      <div className="srv-dashboard-head">
        <div>
          <span className="srv-eyebrow">Analyst Workspace</span>
          <h4>{dashboard.dashboard_title ? `${dashboard.dashboard_title} — Performance Report` : 'Operational Ledger'}</h4>
        </div>
        <time>{dashboard.generated_at || 'Analytical Ledger'}</time>
      </div>

      <div className="srv-report-dense-kpi">
        {dashboard.summary_metrics?.slice(0, 4).map((m, idx) => (
          <div key={idx} className="dense-kpi-row">
            <span className="dense-kpi-label">{m.label}</span>
            <span className="dense-kpi-val">{formatValue(m.value)}</span>
          </div>
        ))}
      </div>

      <div className="srv-report-ledger">
        <TypographyOverline text="Unit Performance Ledger" />
        <TabularLedger rankings={dashboard.rankings || []} />
      </div>

      <div className="srv-report-strategy">
        <TypographyOverline text="Strategic Action Recommendations" />
        <RecommendationList recommendations={dashboard.recommendations || []} />
      </div>
    </div>
  );
}

function TypographyOverline({ text }) {
  return <span className="srv-overline-header">{text}</span>;
}

function EmptyState() {
  return (
    <div className="srv-empty">
      <strong>Data Structure Empty</strong>
      <p>Unable to retrieve matching metrics for this view.</p>
    </div>
  );
}

/* ─── 3. Text View (Markdown Summary) ─── */
function TextResponseView({ text }) {
  return (
    <div className="srv-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN CONTAINER: SplitResponseView (ChatGPT Switcher Style)
   ───────────────────────────────────────────────────────────── */
export default function SplitResponseView({ content, triggerQuery, messageId }) {
  const containerRef = useRef(null);

  // 1. Parsing text and structured json data
  const parsed = useMemo(() => {
    const dashboard = extractJsonBlock(content);
    const fallbackText = extractTextSection(content);
    return {
      text: buildDashboardNarrative(dashboard, fallbackText),
      dashboard,
    };
  }, [content]);

  // 2. Setup the three response versions
  const views = [
    { id: 'dashboard', label: 'Dashboard', icon: HiOutlineChartBar, num: 1 },
    { id: 'report', label: 'Report', icon: HiOutlineCollection, num: 2 },
    { id: 'text', label: 'Text', icon: HiOutlineDocumentText, num: 3 }
  ];

  // 3. Determine best response automatically from user's prompt
  const bestViewId = useMemo(() => {
    const q = String(triggerQuery || '').toLowerCase();
    if (q.includes('chart') || q.includes('graph') || q.includes('visual') || q.includes('dashboard') || q.includes('kpi')) {
      return 'dashboard';
    }
    if (q.includes('report') || q.includes('table') || q.includes('ranking') || q.includes('ledger') || q.includes('list') || q.includes('performance')) {
      return 'report';
    }
    return 'text';
  }, [triggerQuery]);

  // 4. Deterministic 10% check (exactly 1 out of 10 requests shows the split view)
  const isSplitTrigger = useMemo(() => {
    if (!messageId) return false;
    let hash = 0;
    for (let i = 0; i < messageId.length; i++) {
      hash = messageId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 10 === 0;
  }, [messageId]);

  const [activeView, setActiveView] = useState(bestViewId);
  const [compareMode, setCompareMode] = useState(isSplitTrigger);

  // Sync activeView with bestViewId when the prompt updates
  useEffect(() => {
    setActiveView(bestViewId);
    setCompareMode(isSplitTrigger);
  }, [bestViewId, isSplitTrigger]);

  const activeIdx = views.findIndex((v) => v.id === activeView);

  const preserveScroll = (fn) => {
    const scrollTop = window.scrollY;
    fn();
    requestAnimationFrame(() => window.scrollTo({ top: scrollTop }));
  };

  const handleSelectView = (viewId) => {
    preserveScroll(() => {
      setActiveView(viewId);
      setCompareMode(false);
    });
    toast.success(`${viewId.charAt(0).toUpperCase() + viewId.slice(1)} view activated`);
  };

  const handlePrev = () => {
    preserveScroll(() => {
      setCompareMode(false);
      const nextIdx = (activeIdx - 1 + views.length) % views.length;
      setActiveView(views[nextIdx].id);
    });
  };

  const handleNext = () => {
    preserveScroll(() => {
      setCompareMode(false);
      const nextIdx = (activeIdx + 1) % views.length;
      setActiveView(views[nextIdx].id);
    });
  };

  return (
    <div className="srv-shell" ref={containerRef}>
      
      {/* Sleek ChatGPT-style response switcher */}
      <div className="srv-chatgpt-bar">
        <div className="srv-chatgpt-nav">
          <button 
            type="button" 
            className="srv-nav-arrow" 
            onClick={handlePrev} 
            title="Previous version"
          >
            <HiOutlineChevronLeft />
          </button>
          <span className="srv-nav-indicator">
            Response Version: <strong>{activeIdx + 1} / 3</strong>
          </span>
          <button 
            type="button" 
            className="srv-nav-arrow" 
            onClick={handleNext} 
            title="Next version"
          >
            <HiOutlineChevronRight />
          </button>
        </div>

        <div className="srv-chatgpt-pills">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`srv-pill-btn ${!compareMode && activeView === v.id ? 'active' : ''}`}
              onClick={() => handleSelectView(v.id)}
            >
              <v.icon />
              <span>{v.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`srv-pill-btn srv-compare-pill ${compareMode ? 'active' : ''}`}
            onClick={() => setCompareMode(true)}
          >
            <HiOutlineSwitchHorizontal />
            <span>Compare All</span>
          </button>
        </div>
      </div>

      {/* Main content viewport */}
      <div className={`srv-content-viewport ${compareMode ? 'compare-all-mode' : 'single-view-mode'}`}>
        
        {/* VIEWPORT MODE: COMPARE ALL (Split view triggers 1 in 10 times or via compare pill) */}
        {compareMode ? (
          <div className="srv-compare-grid animate-fade-in">
            
            <section className="srv-compare-panel srv-dashboard-panel">
              <header className="srv-panel-header">
                <div>
                  <span className="srv-eyebrow">Interactive Response</span>
                  <h3>Dashboard Layout</h3>
                </div>
              </header>
              <div className="srv-panel-body">
                <DashboardResponseView dashboard={parsed.dashboard} />
              </div>
              <button 
                type="button" 
                className="srv-use-button" 
                onClick={() => handleSelectView('dashboard')}
              >
                Use Dashboard View
              </button>
            </section>

            <section className="srv-compare-panel srv-report-panel">
              <header className="srv-panel-header">
                <div>
                  <span className="srv-eyebrow">Analyst Ledger</span>
                  <h3>Report Layout</h3>
                </div>
              </header>
              <div className="srv-panel-body">
                <ReportResponseView dashboard={parsed.dashboard} />
              </div>
              <button 
                type="button" 
                className="srv-use-button" 
                onClick={() => handleSelectView('report')}
              >
                Use Report View
              </button>
            </section>

            <section className="srv-compare-panel srv-text-panel">
              <header className="srv-panel-header">
                <div>
                  <span className="srv-eyebrow">Narrative Summary</span>
                  <h3>Plain Text Layout</h3>
                </div>
              </header>
              <div className="srv-panel-body">
                <TextResponseView text={parsed.text} />
              </div>
              <button 
                type="button" 
                className="srv-use-button" 
                onClick={() => handleSelectView('text')}
              >
                Use Text View
              </button>
            </section>

          </div>
        ) : (
          /* VIEWPORT MODE: SINGLE CUSTOMIZED RESPONSE */
          <div className="srv-single-panel animate-fade-in-scale">
            <div className="srv-single-body">
              {activeView === 'dashboard' && <DashboardResponseView dashboard={parsed.dashboard} />}
              {activeView === 'report' && <ReportResponseView dashboard={parsed.dashboard} />}
              {activeView === 'text' && <TextResponseView text={parsed.text} />}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
