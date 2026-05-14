import React from 'react';
import './DashboardResponse.css';

export default function DashboardResponse({ data }) {
  if (!data) return null;

  return (
    <div className="dashboard-widget-wrapper animate-fade-in-up">
      <div className="main">
        {/* KPI STRIP */}
        {data.kpis && data.kpis.length > 0 && (
          <div className="kpi-strip">
            {data.kpis.map((kpi, i) => (
              <div key={i} className="kpi-card">
                <div className="kpi-header">
                  <div className={`kpi-icon ${kpi.iconClass || 'icon-blue'}`}>{kpi.icon || '◎'}</div>
                  <div className="kpi-label" dangerouslySetInnerHTML={{ __html: kpi.label }}></div>
                </div>
                <div className="kpi-value">{kpi.value}</div>
                {kpi.delta && (
                  <div className={`kpi-delta ${kpi.status === 'warn' ? 'warn' : ''}`}>
                    {kpi.delta}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TABLE */}
        {data.table && (
          <div className="dash-card">
            <div className="dash-card-header">
              <span className="dash-card-title">{data.table.title || 'Data Breakdown'}</span>
            </div>
            <div className="overflow-x-auto hide-scrollbar">
              <table className="dept-table">
                <thead>
                  <tr>
                    {data.table.headers.map((h, i) => (
                      <th key={i} dangerouslySetInnerHTML={{ __html: h }}></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => {
                        const cellData = typeof cell === 'object' && cell !== null ? cell : { text: cell };
                        return (
                          <td key={j} className={cellData.colorClass || ''}>
                            {j === 0 && cellData.icon ? (
                              <div className="dept-name">
                                <span className="dept-icon">{cellData.icon}</span> {cellData.text}
                              </div>
                            ) : (
                              <span dangerouslySetInnerHTML={{ __html: cellData.text }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {data.table.footer && (
                  <tfoot>
                    <tr>
                      {data.table.footer.map((cell, j) => {
                        const cellData = typeof cell === 'object' && cell !== null ? cell : { text: cell };
                        return (
                          <td key={j} className={cellData.colorClass || ''}>
                            {j === 0 ? (
                              <div className="dept-name" style={{ fontWeight: 700 }}>{cellData.text}</div>
                            ) : (
                              <span dangerouslySetInnerHTML={{ __html: cellData.text }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* BOTTOM PANELS (Donut & Bar) */}
        {(data.donut || data.bar) && (
          <div className="bottom-panels">
            {data.donut && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <span className="dash-card-title">{data.donut.title || 'Distribution'}</span>
                </div>
                <div className="donut-wrap">
                  <div className="donut-svg-wrap">
                    <svg width="140" height="140" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="58" fill="none" stroke="var(--bg-card-alt)" strokeWidth="26"/>
                      {data.donut.segments.map((seg, i) => (
                        <circle
                          key={i} cx="80" cy="80" r="58" fill="none" stroke={`var(--${seg.color || 'blue'})`}
                          strokeWidth="26" strokeDasharray={`${seg.dashLength} 364.4`}
                          strokeDashoffset={seg.dashOffset} strokeLinecap="butt"
                        />
                      ))}
                    </svg>
                    <div className="donut-center">
                      <div className="donut-center-value">{data.donut.totalValue}</div>
                      <div className="donut-center-label">{data.donut.totalLabel || 'Total'}</div>
                    </div>
                  </div>
                  <div className="legend">
                    {data.donut.segments.map((seg, i) => (
                      <div key={i} className="legend-item">
                        <span className="legend-dot" style={{ background: `var(--${seg.color || 'blue'})` }}></span>
                        <span className="legend-label">{seg.label}</span>
                        <span className="legend-val">{seg.value} ({seg.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {data.bar && (
              <div className="dash-card">
                <div className="dash-card-header">
                  <span className="dash-card-title">{data.bar.title || 'Efficiency'}</span>
                </div>
                <div className="bar-chart-wrap">
                  {data.bar.items.map((item, i) => (
                    <div key={i} className="bar-row">
                      <div className="bar-dept">{item.label}</div>
                      <div className="bar-track">
                        <div className={`bar-fill ${item.color || 'blue'}`} style={{ width: `${item.percentage}%` }}>
                          {item.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="bar-xaxis">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
