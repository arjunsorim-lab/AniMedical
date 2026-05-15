import { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import {
  HiOutlineChevronDown,
  HiOutlineRefresh,
  HiOutlineSwitchHorizontal,
  HiOutlineCheckCircle,
} from 'react-icons/hi';
import './SplitResponseView.css';

function extractJsonBlock(content) {
  const match = String(content || '').match(/```json\s*([\s\S]*?)```/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]);
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
  if (normalized === 'positive') return '📈';
  if (normalized === 'negative') return '📉';
  return '•';
}

function alertIcon(severity) {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'high') return '🔴';
  if (normalized === 'medium') return '🟡';
  return '🟢';
}

function buildDashboardNarrative(dashboard, fallbackText) {
  if (!dashboard) return fallbackText;

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

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'positive' || normalized === 'low') return 'positive';
  if (normalized === 'negative' || normalized === 'high') return 'negative';
  if (normalized === 'medium') return 'warning';
  return 'neutral';
}

function ActionBar({ selectedView, compareMode, onSwitch, onRestore }) {
  return (
    <div className="srv-action-bar">
      <div>
        <span className="srv-eyebrow">Response Versions</span>
        <strong>{compareMode ? 'Compare both responses' : `${selectedView === 'text' ? 'Text Summary' : 'Structured Dashboard'} selected`}</strong>
      </div>
      <div className="srv-action-buttons">
        <button type="button" onClick={onSwitch} disabled={!selectedView}>
          <HiOutlineSwitchHorizontal />
          Switch Response Version
        </button>
        <button type="button" onClick={onRestore}>
          <HiOutlineRefresh />
          Restore Both Views
        </button>
      </div>
    </div>
  );
}

function SelectablePanel({ id, title, selectedView, compareMode, onSelect, children, preview }) {
  const isSelected = selectedView === id;
  const isMinimized = !compareMode && selectedView && !isSelected;

  return (
    <section
      className={[
        'srv-panel',
        isSelected ? 'selected' : '',
        isMinimized ? 'minimized' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="srv-panel-header">
        <div>
          <span className="srv-panel-label">{id === 'text' ? 'Narrative' : 'Structured'}</span>
          <h3>{title}</h3>
        </div>
        {isSelected && <span className="srv-selected-pill"><HiOutlineCheckCircle /> Active</span>}
      </header>

      <div className="srv-panel-body">
        {isMinimized ? preview : children}
      </div>

      <button type="button" className="srv-use-button" onClick={() => onSelect(id)}>
        Use This Version
      </button>
    </section>
  );
}

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

function RankingList({ rankings = [] }) {
  if (!rankings.length) return null;
  return (
    <div className="srv-ranked-list">
      {rankings.slice(0, 8).map((item) => (
        <div className="srv-ranked-row" key={`${item.rank}-${item.name}`}>
          <div className="srv-rank-number">{item.rank}</div>
          <div className="srv-rank-main">
            <strong>{item.name}</strong>
            <span>Score {formatValue(item.score)}</span>
          </div>
          <div className="srv-rank-meta">
            <span>{formatValue(item.additional_metrics?.patients_served)} patients</span>
            <span>{formatValue(item.additional_metrics?.efficiency)}% eff.</span>
          </div>
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
          <span>{alert.severity || 'neutral'}</span>
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

function StructuredDashboard({ dashboard }) {
  if (!dashboard) {
    return (
      <div className="srv-empty">
        <strong>Structured dashboard unavailable</strong>
        <p>The response did not include valid dashboard JSON.</p>
      </div>
    );
  }

  return (
    <div className="srv-structured">
      <div className="srv-dashboard-head">
        <div>
          <span className="srv-eyebrow">Dashboard</span>
          <h4>{dashboard.dashboard_title || 'Structured Dashboard Response'}</h4>
        </div>
        <time>{dashboard.generated_at || 'Live'}</time>
      </div>

      <KpiCards metrics={dashboard.summary_metrics || []} />

      {dashboard.top_performer?.name ? (
        <div className="srv-top-performer">
          <span>Top Performer</span>
          <strong>{dashboard.top_performer.name}</strong>
          <p>Score {formatValue(dashboard.top_performer.score)}</p>
        </div>
      ) : null}

      <ExpandableSection title="Ranked Provider List" defaultOpen>
        <RankingList rankings={dashboard.rankings || []} />
      </ExpandableSection>

      <ExpandableSection title="Risk Indicators" defaultOpen>
        <RiskIndicators alerts={dashboard.alerts || []} />
      </ExpandableSection>

      <ExpandableSection title="Recommendations" defaultOpen>
        <RecommendationList recommendations={dashboard.recommendations || []} />
      </ExpandableSection>

      <ExpandableSection title="Insights">
        <RecommendationList recommendations={dashboard.insights || []} />
      </ExpandableSection>

      <ExpandableSection title="Structured Data Summary">
        <div className="srv-json-summary">
          <div><span>KPI cards</span><strong>{dashboard.summary_metrics?.length || 0}</strong></div>
          <div><span>Rankings</span><strong>{dashboard.rankings?.length || 0}</strong></div>
          <div><span>Alerts</span><strong>{dashboard.alerts?.length || 0}</strong></div>
          <div><span>Recommendations</span><strong>{dashboard.recommendations?.length || 0}</strong></div>
        </div>
      </ExpandableSection>
    </div>
  );
}

export default function SplitResponseView({ content }) {
  const containerRef = useRef(null);
  const [selectedView, setSelectedView] = useState(null);
  const [compareMode, setCompareMode] = useState(true);

  const parsed = useMemo(() => {
    const dashboard = extractJsonBlock(content);
    const fallbackText = extractTextSection(content);
    return {
      text: buildDashboardNarrative(dashboard, fallbackText),
      dashboard,
    };
  }, [content]);

  const preserveScroll = (fn) => {
    const scrollTop = window.scrollY;
    fn();
    requestAnimationFrame(() => window.scrollTo({ top: scrollTop }));
  };

  const selectView = (view) => {
    preserveScroll(() => {
      setSelectedView(view);
      setCompareMode(false);
    });
    toast.success(view === 'text' ? 'Text Summary Selected' : 'Structured Dashboard Selected');
  };

  const switchView = () => {
    if (!selectedView) return;
    selectView(selectedView === 'text' ? 'structured' : 'text');
  };

  const restoreView = () => {
    preserveScroll(() => {
      setCompareMode(true);
      setSelectedView(null);
    });
  };

  return (
    <div className="srv-shell" ref={containerRef}>
      <ActionBar
        selectedView={selectedView}
        compareMode={compareMode}
        onSwitch={switchView}
        onRestore={restoreView}
      />

      <div className={`srv-grid ${compareMode ? 'compare' : 'selected-mode'}`}>
        <SelectablePanel
          id="text"
          title="Text Summary Response"
          selectedView={selectedView}
          compareMode={compareMode}
          onSelect={selectView}
          preview={<p>{parsed.text.split('\n').find((line) => line.trim()) || 'Text summary response'}</p>}
        >
          <div className="srv-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{parsed.text}</ReactMarkdown>
          </div>
        </SelectablePanel>

        <SelectablePanel
          id="structured"
          title="Structured Dashboard Response"
          selectedView={selectedView}
          compareMode={compareMode}
          onSelect={selectView}
          preview={<p>{parsed.dashboard?.dashboard_title || 'Structured dashboard response'}</p>}
        >
          <StructuredDashboard dashboard={parsed.dashboard} />
        </SelectablePanel>
      </div>
    </div>
  );
}
