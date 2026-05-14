import { useNavigate } from 'react-router-dom';
import useThemeStore from '../store/useThemeStore';
import { useState, useEffect, useCallback } from 'react';

export default function VoiceAgentLandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback(() => {
    setScrolled(window.scrollY > 40);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  const domains = [
    'voxa.ai',
    'speakly.io',
    'vynta.ai',
    'echofy.ai',
    'voqal.io',
    'nexa.fm'
  ];

  const sectionClass = `py-16 lg:py-20 px-6 lg:px-20`;
  const cardClass = isDark
    ? 'bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8 transition hover:border-blue-400/40 duration-200'
    : 'bg-white shadow-sm border border-blue-100 rounded-2xl p-6 lg:p-8 transition hover:shadow-md hover:border-blue-200 duration-200';

  const btnPrimaryClass = `px-6 py-3 rounded-xl font-semibold transition duration-200 ${
    isDark
      ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:scale-[1.02] shadow-lg shadow-blue-500/20'
      : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:scale-[1.02] shadow-lg shadow-blue-500/20'
  }`;

  const headingClass = isDark ? 'text-white' : 'text-slate-900';
  const subheadingClass = isDark ? 'text-slate-300' : 'text-slate-600';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`min-h-screen overflow-y-auto font-sans ${isDark ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white' : 'bg-gradient-to-br from-blue-50 via-white to-cyan-50 text-slate-800'}`}>
      {/* ─── NAVBAR ─── */}
      <header className={`sticky top-0 z-50 transition-all duration-200 ${
        isDark
          ? `backdrop-blur-md border-b ${scrolled ? 'bg-slate-900/90 border-slate-700/40 shadow-lg' : 'bg-slate-900/60 border-slate-700/20'}`
          : `backdrop-blur-md border-b ${scrolled ? 'bg-white/90 border-blue-100 shadow-md' : 'bg-white/60 border-blue-100/50'}`
      }`}>
        <div className="flex items-center justify-between px-6 lg:px-8 h-16">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
              isDark
                ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                : 'bg-gradient-to-br from-blue-600 to-cyan-500'
            }`}>
              <div className="flex items-center gap-0.5">
                <div className="w-1 h-3 rounded-full bg-white animate-pulse" />
                <div className="w-1 h-5 rounded-full bg-white" />
                <div className="w-1 h-2.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className={`text-lg font-black tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>ANI HEALTHCARE</h1>
              <p className={`text-[10px] ${mutedClass}`}>AI Voice Agent</p>
            </div>
          </div>

          {/* Right side: nav links + theme toggle */}
          <div className="flex items-center gap-4 lg:gap-6">
            <a
              href="#features"
              className={`text-sm font-medium transition ${
                isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Features
            </a>
            <a
              href="#contact"
              className={`text-sm font-medium transition ${
                isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Support
            </a>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition duration-200 ${
                isDark
                  ? 'bg-slate-700/50 text-yellow-400 hover:bg-slate-600/50'
                  : 'bg-blue-100 text-slate-700 hover:bg-blue-200'
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
        {/* Background decorative blobs */}
        <div className={`absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none ${
          isDark ? 'bg-blue-500/15' : 'bg-blue-200/40'
        }`} />
        <div className={`absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none ${
          isDark ? 'bg-cyan-500/15' : 'bg-cyan-200/40'
        }`} />

        <div className="px-6 lg:px-8 py-12 lg:py-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text */}
            <div className="relative z-10">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${
                isDark
                  ? 'bg-blue-500/10 border border-blue-400/20 text-blue-300'
                  : 'bg-blue-100 border border-blue-200 text-blue-700'
              }`}>
                ⚡ AI-Powered Healthcare Operations
              </div>

              <h2 className={`text-4xl lg:text-6xl font-black leading-tight mb-6 ${headingClass}`}>
                Compassionate Care
                <span className={`block bg-clip-text text-transparent bg-gradient-to-r ${
                  isDark ? 'from-blue-400 to-cyan-400' : 'from-blue-600 to-cyan-500'
                }`}>
                  You Can Trust
                </span>
              </h2>

              <p className={`text-base lg:text-lg leading-relaxed max-w-xl mb-8 ${subheadingClass}`}>
                VOXA enables AniHealthcare operations teams to use voice commands to access live dashboards, 
                monitor KPIs, forecast operational trends, and retrieve intelligent insights directly from 
                enterprise data lakes — all through natural conversation.
              </p>

              <button
                onClick={() => navigate('/login')}
                className={btnPrimaryClass}
              >
                Launch Agent
              </button>

              <div className={`mt-10 flex flex-wrap items-center gap-6 lg:gap-10 text-sm ${mutedClass}`}>
                <div>
                  <p className={`text-2xl font-bold ${headingClass}`}>Live</p>
                  <p>Operational Monitoring</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${headingClass}`}>Forecast</p>
                  <p>Predictive Analytics</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${headingClass}`}>Data Lake</p>
                  <p>Unified Insights</p>
                </div>
              </div>
            </div>

            {/* Right: Voice UI Mockup */}
            <div className="relative z-10">
              <div className={`absolute inset-0 rounded-[32px] blur-3xl pointer-events-none ${
                isDark ? 'bg-blue-500/20' : 'bg-blue-200/40'
              }`} />
              <div className={`relative rounded-[32px] p-6 lg:p-8 shadow-xl border overflow-hidden ${
                isDark
                  ? 'bg-white/5 backdrop-blur-xl border-blue-400/20 shadow-blue-500/10'
                  : 'bg-white/80 backdrop-blur-xl border-blue-200 shadow-blue-500/10'
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className={`text-sm ${mutedClass}`}>AniHealthcare Analytics Hub</p>
                    <h3 className={`text-xl font-bold ${headingClass}`}>VOXA AI Voice Agent</h3>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/30" />
                </div>

                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl max-w-sm ${
                    isDark ? 'bg-slate-800/60' : 'bg-blue-50/80'
                  }`}>
                    <p className={`text-xs font-medium ${mutedClass} mb-1`}>Operations Team</p>
                    <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      "Show me weekly operational progress across all healthcare regions."
                    </p>
                  </div>

                  <div className={`p-4 rounded-2xl max-w-sm ml-auto text-white font-medium ${
                    isDark
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-500'
                  }`}>
                    <p className="text-xs opacity-80 mb-1">VOXA</p>
                    <p>"Weekly efficiency increased by 14%. Forecast models predict improved patient engagement next month."</p>
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <div className="flex items-end gap-2 h-12">
                    <div className={`w-2 h-4 rounded-full animate-pulse ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                    <div className={`w-2 h-8 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                    <div className={`w-2 h-12 rounded-full animate-pulse ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`} />
                    <div className={`w-2 h-6 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                    <div className={`w-2 h-10 rounded-full animate-pulse ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className={sectionClass}>
        <div>
          <div className="text-center mb-12 lg:mb-16">
            <p className={`font-semibold mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>FEATURES</p>
            <h3 className={`text-3xl lg:text-4xl font-black mb-4 ${headingClass}`}>Comprehensive Healthcare Operations Platform</h3>
            <p className={`max-w-2xl mx-auto ${subheadingClass}`}>
              Empowering healthcare teams with AI-powered voice intelligence, live analytics, and predictive insights
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                title: 'Healthcare Dashboards',
                desc: 'Track weekly, monthly, and yearly healthcare performance with live AI dashboards and real-time KPI monitoring across all facilities.'
              },
              {
                title: 'Data Lake Intelligence',
                desc: 'Connect VOXA directly with enterprise data lakes, CRMs, EMR systems, and cloud platforms for unified operational visibility.'
              },
              {
                title: 'AI Forecasting',
                desc: 'Generate predictive healthcare insights, risk alerts, and operational forecasts in real time using advanced machine learning models.'
              }
            ].map((item, i) => (
              <div key={i} className={cardClass}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                  isDark
                    ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-500'
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {i === 0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    ) : i === 1 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    )}
                  </svg>
                </div>
                <h4 className={`text-xl font-bold mb-3 ${headingClass}`}>{item.title}</h4>
                <p className={`leading-relaxed text-sm ${mutedClass}`}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Use Cases */}
          <div className="mt-20 lg:mt-28">
            <div className="text-center mb-12 lg:mb-16">
              <p className={`font-semibold mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>USE CASES</p>
              <h3 className={`text-3xl lg:text-4xl font-black mb-4 ${headingClass}`}>AI Voice Assistant for Healthcare Operations</h3>
              <p className={`max-w-3xl mx-auto ${subheadingClass}`}>
                VOXA connects directly with enterprise systems and healthcare data lakes to help operations teams 
                retrieve insights, monitor KPIs, and make faster decisions using natural voice conversations.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {[
                {
                  title: 'Operational Performance Dashboard',
                  desc: 'Managers can ask VOXA: "Show this week\'s production efficiency and downtime across all facilities" and instantly view live operational dashboards with trends and KPI summaries.'
                },
                {
                  title: 'Forecasting & Predictive Analytics',
                  desc: 'VOXA analyzes historical healthcare and operational data to forecast staffing needs, risks, maintenance schedules, and inventory demand with high accuracy.'
                },
                {
                  title: 'Data Lake Insights',
                  desc: 'The AI voice assistant securely fetches information from enterprise data lakes, ERP systems, and reporting platforms to provide instant summaries and actionable insights.'
                },
                {
                  title: 'Executive Voice Reporting',
                  desc: 'Executives can ask questions like "What changed this month?" or "Show facilities below target performance" and receive AI-generated summaries with visual dashboard updates.'
                }
              ].map((item, i) => (
                <div key={i} className={cardClass}>
                  <h4 className={`text-xl font-bold mb-3 ${headingClass}`}>{item.title}</h4>
                  <p className={`leading-relaxed text-sm ${mutedClass}`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── DOMAIN SUGGESTIONS / SUPPORT ─── */}
      <section id="contact" className={sectionClass}>
        <div>
          <div className={`rounded-[32px] p-8 lg:p-10 border ${
            isDark
              ? 'bg-white/5 border-white/10'
              : 'bg-white border-blue-100 shadow-sm'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div>
                <p className={`font-semibold mb-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>CONTACT & SUPPORT</p>
                <h3 className={`text-3xl lg:text-4xl font-black mb-4 ${headingClass}`}>Get In Touch</h3>
                <p className={`max-w-xl leading-relaxed ${mutedClass}`}>
                  Have questions about VOXA or want to schedule a demo? Contact our support team — 
                  we are here to help your healthcare operations run smoothly.
                </p>
                <div className={`mt-6 space-y-2 text-sm ${subheadingClass}`}>
                  <p>📧 info@anihealthcareusa.com</p>
                  <p>📞 +1 302-319-8475</p>
                  <p>📍 300 Delaware Ave. Suite 210, #316 Wilmington, DE 19801</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-[260px]">
                {domains.map((domain, index) => (
                  <div
                    key={index}
                    className={`px-4 py-3 rounded-xl text-center font-semibold text-sm transition duration-200 ${
                      isDark
                        ? 'bg-slate-800/60 border border-white/10 hover:border-blue-400/40'
                        : 'bg-blue-50/80 border border-blue-100 hover:border-blue-300'
                    }`}
                  >
                    {domain}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 lg:px-20 pb-16 lg:pb-20">
        <div>
          <div className={`relative overflow-hidden rounded-[32px] p-10 lg:p-14 ${
            isDark
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
              : 'bg-gradient-to-r from-blue-600 to-cyan-500'
          } text-white`}>
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_left,_white,_transparent_40%)] pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
              <div>
                <h3 className="text-3xl lg:text-4xl font-black mb-3">
                  Voice-Powered Healthcare Operations
                </h3>
                <p className="text-base max-w-2xl text-white/80">
                  Enable healthcare teams to access dashboards, retrieve insights from enterprise data lakes, 
                  and monitor business performance using natural voice interactions.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className={`px-6 py-3 rounded-xl font-bold transition whitespace-nowrap ${
                  isDark
                    ? 'bg-white text-blue-600 hover:bg-blue-50 hover:scale-[1.02]'
                    : 'bg-white text-blue-700 hover:bg-blue-50 hover:scale-[1.02]'
                } shadow-lg`}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className={`border-t py-8 px-6 lg:px-20 ${
        isDark ? 'border-slate-800' : 'border-blue-100'
      }`}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className={`text-sm ${mutedClass}`}>
            &copy; {new Date().getFullYear()} Ani Healthcare, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className={`${mutedClass} hover:text-blue-500 transition`}>Features</a>
            <a href="#contact" className={`${mutedClass} hover:text-blue-500 transition`}>Support</a>
            <button
              onClick={() => navigate('/login')}
              className="text-blue-500 hover:text-blue-600 font-medium transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}