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

  const metricDescriptions = {
    "total patients": "Total patient profiles registered in our clinical records system.",
    "active patients": "Patients currently undergoing active care, follow-up, or hospital visits.",
    "total billing": "Cumulative billing generated from all clinical procedures, visits, and treatments.",
    "vitals alerts": "Active warnings triggered when vital signs (like BP, pulse) deviate from safe levels.",
    "overloaded providers": "Doctors assigned caseloads above normal limits, potentially causing longer wait times.",
    "recovery rate": "The percentage of patients who completed treatment and recovered successfully.",
    "readmission rate": "Patients requiring another hospital stay within 30 days of their discharge.",
    "critical patients": "Patients currently flagged with acute or high-risk clinical conditions.",
    "critical ratio": "The proportion of active patients who need high-priority clinical tracking.",
    "top region": "Our busiest regional territory by patient volume.",
    "pending amount": "Uncollected billing outstanding that is currently in accounts receivable.",
    "pending cases": "Total number of unpaid billing invoices requiring administrative follow-up.",
    "service revenue": "Revenue generated directly from outpatient and inpatient treatments."
  };

  const metricLines = metrics.length
    ? metrics.slice(0, 6).map((metric) => {
        const key = String(metric.label || '').toLowerCase().trim();
        const desc = metricDescriptions[key] || "Dashboard performance metric.";
        return `- ${metricIcon(metric.status)} **${metric.label || 'Metric'}**: **${formatValue(metric.value)}** — *${desc}*`;
      })
    : ['- • **Metrics**: No KPI metrics were available for this dashboard.'];

  const alertLines = alerts.length
    ? alerts.map((alert) => (
        `${alertIcon(alert.severity)} **[${String(alert.severity || 'info').toUpperCase()}]** ${alert.message || 'Attention needed on this item.'}`
      ))
    : ['🟢 **[CLEAR]** No active risk warnings or critical clinical alerts are present.'];

  const insightLines = insights.length
    ? insights.map((item) => `- ${item}`)
    : ['- No specific analytical insights were generated for this query.'];

  const rankingLines = rankings.length
    ? rankings.slice(0, 8).map((item, index) => {
        const meta = item.additional_metrics || {};
        const detail = [
          Number(meta.patients_served) > 0 ? `${meta.patients_served} patients served` : '',
          Number(meta.efficiency) > 0 ? `${meta.efficiency}% operational efficiency` : '',
          Number(meta.revenue) > 0 ? `$${formatValue(meta.revenue)} revenue generated` : '',
        ].filter(Boolean).join(', ');
        return `${index + 1}. 🏆 **${item.name || `Item ${index + 1}`}** — Volume/Score: **${formatValue(item.score)}** ${detail ? `(${detail})` : ''}`;
      })
    : ['No ranking data is available for this category.'];

  const recommendationLines = recommendations.length
    ? recommendations.map((item, index) => {
        const actionTypes = ['Primary Priority', 'Secondary Action', 'Long-term Guidance', 'Monitoring Step'];
        const type = actionTypes[index % actionTypes.length];
        return `${index + 1}. **${type}**: ${item}`;
      })
    : [
        '1. **Primary Priority**: Review overall system caseloads and verify if billing aligns with patient volumes.',
        '2. **Secondary Action**: Investigate any high-risk vitals alerts or clinical overloading reported by providers.',
        '3. **Long-term Guidance**: Compare highest-performing regions/doctors with others to share best practices.',
      ];

  return [
    '## 📝 Executive Summary',
    `This report provides a clear, layman-friendly summary of **${title}**. It translates clinical data, doctor caseloads, and hospital revenue metrics into simple, actionable insights.`,
    '',
    '## 📊 Key Metrics Explained',
    ...metricLines,
    '',
    '## 🚨 Risk & Alert Warnings',
    ...alertLines,
    '',
    '## 💡 Simple Health Insights',
    `**Current Focus**: ${title}`,
    '',
    `* **Top Performer**: **${topName}** is currently leading in patient outcomes or volume with a score of **${formatValue(topScore)}**.`,
    `* **Lowest volume area**: **${lowestName}** shows the lowest relative caseload or activity in this view.`,
    '',
    ...insightLines,
    '',
    '## 🏆 Performance Rankings',
    'Below is a simple ranking showing how different segments or regions compare in workload and services:',
    '',
    ...rankingLines,
    '',
    '## 🎯 Strategic Action Plan',
    'Here are the key recommendations to improve hospital operations, patient recovery, and billing balance:',
    '',
    ...recommendationLines,
    '',
    '## 🚀 How to Use This Information',
    '1. **Address Critical Flags**: Focus on patients with active vitals warnings or doctors with overload flags first.',
    '2. **Share Success**: Learn from our top-performing areas (like **' + topName + '**) and apply their methods to other clinics.',
    '3. **Monitor Progress**: Re-run this checkup report weekly to track how recovery rates and caseloads improve over time.',
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
  if (!alerts.length) {
    return (
      <div className="srv-risk-item positive">
        <span className="srv-alert-badge positive">stable</span>
        <p>🟢 All health parameters and clinical provider workloads are within normal bounds. No active risks or alerts detected.</p>
      </div>
    );
  }
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
  if (!recommendations.length) {
    return (
      <div className="text-xs text-[var(--txt3)] italic p-3">
        No active action items for this context.
      </div>
    );
  }
  
  const getRecommendationHeader = (index) => {
    const headers = [
      { title: "Immediate Action Plan", badge: "High Priority", bg: "rgba(239, 68, 68, 0.12)", text: "#EF4444" },
      { title: "Workflow & Efficiency Boost", badge: "Medium Priority", bg: "rgba(245, 158, 11, 0.12)", text: "#F59E0B" },
      { title: "Clinical Outreach Strategy", badge: "Recommended", bg: "rgba(59, 130, 246, 0.12)", text: "#3B82F6" },
      { title: "Continuous Monitoring Plan", badge: "Standard Priority", bg: "rgba(16, 185, 129, 0.12)", text: "#10B981" }
    ];
    return headers[index % headers.length];
  };

  return (
    <div className="srv-rec-grid">
      {recommendations.map((item, index) => {
        const meta = getRecommendationHeader(index);
        return (
          <div className="srv-rec-card animate-fade-in" key={`${item}-${index}`} style={{ borderLeft: `4px solid ${meta.text}` }}>
            <div className="srv-rec-card-header">
              <span className="srv-rec-title">{meta.title}</span>
              <span className="srv-rec-badge" style={{ backgroundColor: meta.bg, color: meta.text }}>{meta.badge}</span>
            </div>
            <p className="srv-rec-text">{item}</p>
          </div>
        );
      })}
    </div>
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

        <ExpandableSection title="Strategic Action Recommendations" defaultOpen>
          <RecommendationList recommendations={dashboard.recommendations || []} />
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

      <div className="srv-report-insights" style={{ marginTop: '16px' }}>
        <TypographyOverline text="AI Insights Analysis" />
        <RecommendationList recommendations={dashboard.insights || []} />
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
    
    // Explicit report/tabular intent keywords
    if (
      q.includes('report') || 
      q.includes('table') || 
      q.includes('ranking') || 
      q.includes('ledger') || 
      q.includes('list') || 
      q.includes('performance') || 
      q.includes('rank') || 
      q.includes('distribution') ||
      q.includes('per doctor')
    ) {
      return 'report';
    }
    
    // Explicit dashboard/visual/metric intent keywords
    if (
      q.includes('chart') || 
      q.includes('graph') || 
      q.includes('visual') || 
      q.includes('dashboard') || 
      q.includes('kpi') ||
      q.includes('patient') ||
      q.includes('patience') ||
      q.includes('doctor') ||
      q.includes('revenue') ||
      q.includes('vitals') ||
      q.includes('alert') ||
      q.includes('serve') ||
      q.includes('critical') ||
      q.includes('payment') ||
      q.includes('trend') ||
      q.includes('load') ||
      /\b(count|sum|total|average|rate|percentage|active)\b/.test(q)
    ) {
      return 'dashboard';
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
