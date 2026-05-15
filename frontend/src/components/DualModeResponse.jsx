import { useEffect, useState, useMemo } from "react";
import { FaRegCheckCircle, FaArrowRight, FaArrowLeft, FaExclamationTriangle, FaChartBar, FaTable, FaUsers, FaClipboardList } from "react-icons/fa";
import {
  Box,
  Button,
  Typography,
  Tooltip,
} from "@mui/material";
import "./DualModeResponse.css";
import { getProviderLoadDashboard } from "../services/api";

/* ─── Data Utilities ─── */

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

function extractMetrics(content) {
  const text = String(content || '');
  const metricRegex = /(?:^|\n)\s*(?:[-*]\s*)?(?:\*\*)?([A-Za-z][A-Za-z /%-()]{2,40})(?:\*\*)?\s*[:=-]\s*([^\n|]{1,240})/g;
  const metrics = [];
  let match = metricRegex.exec(text);
  while (match && metrics.length < 10) {
    metrics.push({ label: match[1].trim(), value: match[2].trim() });
    match = metricRegex.exec(text);
  }
  return metrics;
}

/* ─── Helpers ─── */
function getStatusBadge(value, status) {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus.includes('over')) return { label: 'Overloaded', cls: 'badge-danger' };
  if (normalizedStatus.includes('normal') || normalizedStatus.includes('stable')) return { label: 'Stable', cls: 'badge-success' };

  const num = parseFloat(value);
  if (num >= 85) return { label: 'Overloaded', cls: 'badge-danger' };
  if (num >= 70) return { label: 'Moderate', cls: 'badge-warning' };
  return { label: 'Stable', cls: 'badge-success' };
}

function isOverloadedProvider(provider) {
  return String(provider.status || '').toLowerCase().includes('over') || provider.workload >= 85;
}

function isModerateProvider(provider) {
  return !isOverloadedProvider(provider) && provider.workload >= 70;
}

function getWorkloadFill(provider) {
  if (isOverloadedProvider(provider)) return 'linear-gradient(90deg,#ef4444,#f87171)';
  if (isModerateProvider(provider)) return 'linear-gradient(90deg,#f59e0b,#fbbf24)';
  return 'linear-gradient(90deg,#10b981,#34d399)';
}

/* ─── Shared: Status Pill ─── */
const StatusPill = ({ value, status }) => {
  const badge = getStatusBadge(value, status);
  return <span className={`status-pill ${badge.cls}`}>{badge.label}</span>;
};

function clampPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function buildFallbackDoctorData(table, limit) {
  const rows = table?.rows || [];
  const workloads = rows.map((r, i) => parseFloat(r[3]) || (70 + (i * 5) % 28));
  const effValues = rows.map((r, i) => parseFloat(r[4]) || (75 + (i * 3) % 20));

  return rows.slice(0, limit).map((r, i) => ({
    name: String(r[0] || 'Dr. Unknown'),
    patients: parseInt(r[1]) || 0,
    status: '',
    workload: clampPercent(workloads[i]),
    efficiency: clampPercent(effValues[i]),
  }));
}

function getDoctorData(dashboardData, table, limit) {
  const providers = dashboardData?.providers || [];
  if (providers.length > 0) {
    return providers.slice(0, limit).map((provider) => ({
      name: String(provider.name || 'Unknown provider'),
      patients: Number(provider.patients) || 0,
      status: String(provider.status || ''),
      workload: clampPercent(provider.workload),
      efficiency: clampPercent(provider.efficiency),
    }));
  }

  return buildFallbackDoctorData(table, limit);
}

function getMetricItems(dashboardData, metrics) {
  if (!dashboardData?.summary) return metrics;

  const summary = dashboardData.summary;
  return [
    { label: 'Total Patients', value: Number(summary.total_patients || 0).toLocaleString() },
    { label: 'Active Patients', value: Number(summary.active_patients || 0).toLocaleString() },
    { label: 'Total Doctors', value: Number(summary.total_doctors || 0).toLocaleString() },
    { label: 'Overloaded Count', value: Number(summary.overloaded_count || 0).toLocaleString() },
    { label: 'Avg Patients / Doctor', value: Number(summary.average_patients_per_doctor || 0).toLocaleString() },
  ];
}

/* ───────────────────────────────────────────────
   VIEW 1: REPORT-CENTRIC (Analyst Workspace)
   Dense tables, KPIs, operational data
   ─────────────────────────────────────────────── */
const ReportDashboard = ({ table, metrics, dashboardData }) => {
  const doctorData = getDoctorData(dashboardData, table, 8);
  const metricItems = getMetricItems(dashboardData, metrics);

  const avgPatients = doctorData.length > 0
    ? Math.round(doctorData.reduce((s, d) => s + d.patients, 0) / doctorData.length)
    : 0;
  const avgWorkload = doctorData.length > 0
    ? Math.round(doctorData.reduce((s, d) => s + d.workload, 0) / doctorData.length)
    : 0;
  const overloaded = dashboardData?.summary?.overloaded_count ?? doctorData.filter(isOverloadedProvider).length;

  return (
    <div className="report-dashboard">
      {/* KPI Strip — dense */}
      <div className="rd-kpi-strip">
        <div className="rd-kpi"><span className="rd-kpi-val">{avgPatients.toLocaleString()}</span><span className="rd-kpi-lbl">Avg Patients</span></div>
        <div className="rd-kpi"><span className="rd-kpi-val">{avgWorkload}%</span><span className="rd-kpi-lbl">Avg Workload</span></div>
        <div className="rd-kpi"><span className="rd-kpi-val rd-val-danger">{Number(overloaded).toLocaleString()}</span><span className="rd-kpi-lbl">Overloaded</span></div>
        <div className="rd-kpi"><span className="rd-kpi-val">{Number(dashboardData?.summary?.total_doctors || doctorData.length).toLocaleString()}</span><span className="rd-kpi-lbl">Total Providers</span></div>
      </div>

      {/* Main Table — full detail */}
      <div className="rd-table-section">
        <Typography variant="overline" className="rd-section-title">Provider Performance Detail</Typography>
        <div className="rd-table-scroll">
          <table className="rd-table">
            <thead>
              <tr>
                <th>Doctor Name</th>
                <th>Patients</th>
                <th>Status</th>
                <th>Workload</th>
                <th>Efficiency</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {doctorData.map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? 'rz-even' : 'rz-odd'}>
                  <td className="td-name">{d.name}</td>
                  <td className="td-num">{d.patients.toLocaleString()}</td>
                  <td><StatusPill value={d.workload} status={d.status} /></td>
                  <td className="td-num">
                    <span className={`td-pct ${isOverloadedProvider(d) ? 'pct-d' : isModerateProvider(d) ? 'pct-w' : 'pct-s'}`}>{d.workload}%</span>
                    <div className="td-bar"><div className="td-bar-fill" style={{ width: `${d.workload}%`, background: getWorkloadFill(d) }} /></div>
                  </td>
                  <td className="td-num">{d.efficiency}%</td>
                  <td className="td-num">
                    {isOverloadedProvider(d) ? <span className="risk-badge risk-high">High</span> :
                      isModerateProvider(d) ? <span className="risk-badge risk-med">Med</span> :
                        <span className="risk-badge risk-low">Low</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metrics Grid — dense */}
      <div className="rd-metrics-grid">
        {metricItems.slice(0, 6).map((m, i) => (
          <div key={i} className="rd-metric-item">
            <span className="rd-metric-lbl">{m.label}</span>
            <span className="rd-metric-val">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ───────────────────────────────────────────────
   VIEW 2: VISUAL-CENTRIC (Executive Dashboard)
   Large charts, KPIs, AI insights, minimal tables
   ─────────────────────────────────────────────── */
const VisualDashboard = ({ table, dashboardData }) => {
  const doctorData = getDoctorData(dashboardData, table, 6);

  const overloaded = dashboardData?.summary?.overloaded_count ?? doctorData.filter(isOverloadedProvider).length;
  const overloadedNames = doctorData.filter(isOverloadedProvider).map(d => d.name);

  return (
    <div className="visual-dashboard">
      {/* Hero KPI Cards — large */}
      <div className="vd-kpi-grid">
        <div className="vd-kpi-card vd-kpi-primary">
          <FaChartBar className="vd-kpi-icon" />
          <span className="vd-kpi-val">{Number(overloaded).toLocaleString()}</span>
          <span className="vd-kpi-lbl">Overloaded Providers</span>
          <span className="vd-kpi-sub">Requires immediate attention</span>
        </div>
        <div className="vd-kpi-card vd-kpi-success">
          <FaUsers className="vd-kpi-icon" />
          <span className="vd-kpi-val">{Number(dashboardData?.summary?.total_doctors || doctorData.length).toLocaleString()}</span>
          <span className="vd-kpi-lbl">Active Providers</span>
          <span className="vd-kpi-sub">Currently on shift</span>
        </div>
        <div className="vd-kpi-card vd-kpi-warning">
          <FaClipboardList className="vd-kpi-icon" />
          <span className="vd-kpi-val">
            {doctorData.length > 0 ? Math.round(doctorData.reduce((s, d) => s + d.efficiency, 0) / doctorData.length) : 0}%
          </span>
          <span className="vd-kpi-lbl">Avg Efficiency</span>
          <span className="vd-kpi-sub">Across all providers</span>
        </div>
        <div className="vd-kpi-card vd-kpi-info">
          <FaTable className="vd-kpi-icon" />
          <span className="vd-kpi-val">
            {Number(dashboardData?.summary?.total_patients || doctorData.reduce((s, d) => s + d.patients, 0)).toLocaleString()}
          </span>
          <span className="vd-kpi-lbl">Total Patients</span>
          <span className="vd-kpi-sub">Current caseload</span>
        </div>
      </div>

      {/* AI Insight Banner — large */}
      {overloadedNames.length > 0 && (
        <div className="vd-insight-banner">
          <div className="vd-insight-header">
            <span className="vd-insight-badge"><FaExclamationTriangle /> AI Recommendation</span>
            <span className="vd-confidence">High Confidence</span>
          </div>
          <p className="vd-insight-text">
            <strong>{overloadedNames.join(' and ')}</strong>
            {' '}operating above safe thresholds. Redistribute patients to optimize workload balance.
          </p>
        </div>
      )}

      {/* Large Visual Bars */}
      <div className="vd-chart-section">
        <Typography variant="overline" className="vd-section-title">Provider Workload Overview</Typography>
        <div className="vd-bars">
          {doctorData.map((d, i) => (
            <Tooltip key={i} title={`${d.name}: ${d.workload}% workload, ${d.efficiency}% efficiency`} arrow>
              <div className="vd-bar-row">
                <span className="vd-bar-name">{d.name.length > 14 ? d.name.substring(0, 12) + '…' : d.name}</span>
                <div className="vd-bar-track">
                  <div className="vd-bar-fill" style={{ width: `${d.workload}%`, background: getWorkloadFill(d) }} />
                </div>
                <span className="vd-bar-pct">{d.workload}%</span>
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Mini Table — minimal */}
      <div className="vd-mini-table">
        <Typography variant="overline" className="vd-section-title">Quick Reference</Typography>
        <table className="vd-table">
          <thead>
            <tr><th>Doctor</th><th>Status</th><th>Load</th></tr>
          </thead>
          <tbody>
            {doctorData.slice(0, 4).map((d, i) => (
              <tr key={i}>
                <td>{d.name}</td>
                <td><StatusPill value={d.workload} status={d.status} /></td>
                <td className="td-num">{d.workload}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Comparison Preview Card (in comparison mode) ─── */
const PreviewCard = ({ type, content, onChoose }) => {
  const isReport = type === 'report';
  const title = isReport ? 'Report-Centric View' : 'Visual-Centric View';
  const desc = isReport
    ? 'Detailed operational analytics with comprehensive data tables, deep metrics, and structured provider insights.'
    : 'Executive dashboard with large visualizations, KPI highlights, and AI-powered recommendations for quick decision-making.';
  const strengths = isReport
    ? ['Deep Analysis', 'Data Tables', 'Operational Metrics', 'Drill-Down']
    : ['Large Charts', 'KPI Cards', 'AI Insights', 'Quick Scan'];
  const useCase = isReport ? 'Best for analysts and operations teams' : 'Best for executives and managers';

  return (
    <div className={`preview-card ${isReport ? 'preview-report' : 'preview-visual'}`}>
      <div className="preview-header">
        <span className={`preview-dot ${isReport ? 'dot-report' : 'dot-visual'}`} />
        <Typography variant="h6" className="preview-title">{title}</Typography>
      </div>
      <Typography variant="body2" className="preview-desc">{desc}</Typography>
      <div className="preview-strengths">
        {strengths.map((s, i) => <span key={i} className="preview-pill">{s}</span>)}
      </div>
      <Typography variant="caption" className="preview-use-case">{useCase}</Typography>

      {/* Mini content preview */}
      <div className="preview-content">
        {content}
      </div>

      <Button
        variant="contained"
        startIcon={<FaRegCheckCircle />}
        onClick={onChoose}
        className="preview-choose-btn"
      >
        Choose This View
      </Button>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   DUAL MODE RESPONSE — Main Component
   Two states: comparison ↔ focused dashboard
   ═══════════════════════════════════════════════ */
const DualModeResponse = ({ content, response1, response2, onContinue }) => {
  const [selected, setSelected] = useState(null); // null | 0 | 1
  const [focused, setFocused] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  const parsed = useMemo(() => {
    if (!content) return null;
    const text = String(content).trim();
    const table = parseMarkdownTable(text);
    const metrics = extractMetrics(text);
    return { cleanContent: text, table, metrics };
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    getProviderLoadDashboard()
      .then((data) => {
        if (!cancelled) setDashboardData(data);
      })
      .catch((error) => {
        console.warn('Provider dashboard data unavailable, falling back to response content:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!parsed && !response1 && !response2) return null;

  const r1 = response1 || {
    title: 'Report-Centric View',
    content: <ReportDashboard table={parsed.table} metrics={parsed.metrics} dashboardData={dashboardData} />
  };
  const r2 = response2 || {
    title: 'Visual-Centric View',
    content: <VisualDashboard table={parsed.table} metrics={parsed.metrics} dashboardData={dashboardData} />
  };

  const handleChoose = (idx) => {
    setSelected(idx);
  };

  const handleContinue = () => {
    if (selected !== null) {
      setFocused(true);
      if (onContinue) onContinue(selected);
    }
  };

  const handleBackToCompare = () => {
    setFocused(false);
  };

  // ─── FOCUSED DASHBOARD MODE ───
  if (focused && selected !== null) {
    const chosen = selected === 0 ? r1 : r2;
    const isReport = selected === 0;

    return (
      <Box className="dual-mode-wrapper focused-mode">
        <Box className="focused-container">
          {/* Top bar */}
          <Box className="focused-topbar">
            <Button
              startIcon={<FaArrowLeft />}
              onClick={handleBackToCompare}
              className="back-btn"
            >
              Compare Views
            </Button>
            <Typography variant="overline" className="focused-label">
              {isReport ? 'Analyst Workspace' : 'Executive Dashboard'} — Active View
            </Typography>
          </Box>

          {/* Dashboard */}
          <Box className={`focused-dashboard ${isReport ? 'focused-report' : 'focused-visual'}`}>
            <Box className="focused-header">
              <span className={`focused-dot ${isReport ? 'dot-report' : 'dot-visual'}`} />
              <Typography variant="h5" className="focused-title">
                {chosen.title}
              </Typography>
            </Box>
            <Box className="focused-content">
              {chosen.content}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  // ─── COMPARISON MODE ───
  return (
    <Box className="dual-mode-wrapper comparison-mode">
      <Box className="dual-mode-container">
        <Box className="dual-mode-header">
          <Typography variant="h5" className="dual-mode-heading">
            Choose Your Dashboard View
          </Typography>
          <Typography variant="body2" className="dual-mode-subheading">
            Two distinct layouts optimized for different workflows. Compare and select the best fit.
          </Typography>
        </Box>

        <Box className="cards-wrapper">
          <PreviewCard
            type="report"
            content={<ReportDashboard table={parsed.table} metrics={parsed.metrics} dashboardData={dashboardData} />}
            onChoose={() => handleChoose(0)}
          />
          <PreviewCard
            type="visual"
            content={<VisualDashboard table={parsed.table} metrics={parsed.metrics} dashboardData={dashboardData} />}
            onChoose={() => handleChoose(1)}
          />
        </Box>

        {/* Continue CTA */}
        {selected !== null && (
          <Box className="continue-bar animate-fade-up">
            <Typography variant="body2" className="continue-text">
              You've selected <strong>{selected === 0 ? 'Report-Centric' : 'Visual-Centric'} View</strong>
            </Typography>
            <Button
              variant="contained"
              endIcon={<FaArrowRight />}
              onClick={handleContinue}
              className="continue-btn"
            >
              Continue with {selected === 0 ? 'Report' : 'Visual'} View
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DualModeResponse;
