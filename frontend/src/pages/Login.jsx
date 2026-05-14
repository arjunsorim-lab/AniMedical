import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiMail, HiLockClosed, HiArrowRight, HiSparkles, HiEye, HiEyeOff } from 'react-icons/hi';
import useAuthStore from '../store/useAuthStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      toast.success('Access Granted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[var(--bg)] overflow-y-auto">

      {/* ── Left Side: Immersive Hero Area (Hidden on Mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[var(--bg2)] border-r border-[var(--brd)]">
        {/* The Hero Image */}
        <img
          src="/images/auth-hero.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 scale-105 animate-pulse"
          style={{ animationDuration: '8s' }}
        />

        {/* Overlays for Depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg2)]/60 via-transparent to-[var(--bg)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(212,175,55,0.15)_0%,transparent_50%)]" />

        {/* Content in Hero */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-16 xl:p-24">
          <div className="flex items-center gap-3">
            {/* <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shadow-lg shadow-gold-600/20"> */}
              {/* <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="var(--bg)" strokeWidth="3" />
                <circle cx="20" cy="20" r="4" fill="var(--bg)" />
                <path d="M20 8V16M24 23L33 28M16 23L7 28" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" />
              </svg> */}
              <img src="./Blue-and-Green-Modern-Medical-Logo-2-scaled-removebg-preview.png" alt="" />
            {/* </div> */}
            {/* <span className="text-2xl font-black text-[var(--txt)] tracking-tighter">AniCare Vox</span> */}
          </div>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--brd)] border border-[var(--brd2)] mb-6 backdrop-blur-md">
              <HiSparkles className="text-[var(--gold-acc)]" />
              <span className="text-[10px] font-bold text-[var(--txt2)] uppercase tracking-[0.2em]">Next-Gen Neural Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black text-[var(--txt)] leading-tight tracking-tighter mb-3">
              The Future of <br />
              <span className="text-gold-gradient">Voice Intelligence.</span>
            </h2>
            <p className="text-sm xl:text-base text-[var(--txt2)] leading-relaxed max-w-lg font-medium">
              Experience a new era of human-machine interaction through our advanced neural voice processing system.
            </p>
          </div>

          <div className="flex items-center gap-8 border-t border-[var(--brd)] pt-12">
            <div className="flex flex-col">
              <span className="text-3xl font-black text-[var(--txt)]">99.9%</span>
              <span className="text-[10px] font-bold text-[var(--txt3)] uppercase tracking-widest mt-1">Uptime</span>
            </div>
            <div className="w-px h-10 bg-[var(--brd)]" />
            <div className="flex flex-col">
              <span className="text-3xl font-black text-[var(--txt)]">2.4ms</span>
              <span className="text-[10px] font-bold text-[var(--txt3)] uppercase tracking-widest mt-1">Latency</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Side: Professional Auth Pane ── */}
      <div className="flex-1 lg:w-1/2 flex flex-col justify-center items-start px-8 sm:px-16 lg:px-24 xl:px-32 bg-[var(--bg)] relative overflow-y-auto hide-scrollbar min-h-screen pt-12 pb-12">

        {/* Top Header Branding */}
        <div className="absolute top-10 flex items-center gap-2">
          {/* <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shadow-lg shadow-gold-600/20"> */}
            {/* <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16" stroke="var(--bg)" strokeWidth="4" />
              <path d="M20 8V16M24 23L33 28M16 23L7 28" stroke="var(--bg)" strokeWidth="4" strokeLinecap="round" />
            </svg> */}'
            <img src="./public/Blue-and-Green-Modern.png" className='w-[50px]' alt="" />'
          {/* </div> */}
          <span className="text-xl font-black text-[var(--txt)] tracking-tighter">AniCare Vox</span>
        </div>

        <div className="w-full max-w-[340px] animate-fade-in-scale">
          <div className="mb-4">
            <h3 className="text-2xl font-black text-[var(--txt)] tracking-tighter mb-1">Sign In</h3>
            <p className="text-[var(--txt3)] text-[10px] font-medium uppercase tracking-wider">Access the AI Assistant.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.25em] ml-1">Email or Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                  <HiMail className="text-xl" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[var(--brd)] border border-[var(--brd2)] rounded-2xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all"
                  placeholder="Enter your email or username"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.25em] ml-1">Password</label>
                <Link to="/password-reset" className="text-[9px] font-bold text-[var(--gold-acc)] uppercase tracking-widest hover:opacity-80 transition-opacity">Reset Key</Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                  <HiLockClosed className="text-xl" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-[var(--brd)] border border-[var(--brd2)] rounded-2xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--txt3)] hover:text-[var(--gold-acc)] transition-colors"
                >
                  {showPassword ? <HiEyeOff className="text-xl" /> : <HiEye className="text-xl" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="animate-shine w-full flex items-center justify-center py-4 px-6 rounded-2xl bg-gradient-to-r from-[#3B82F6] via-[#BFDBFE] to-[#1D4ED8] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-600/20 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[#0B0B0F] font-black text-[10px] uppercase tracking-[0.3em]">Login</span>
                  <HiArrowRight className="text-[#0B0B0F] text-lg group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[var(--brd)] w-full">
            <p className="text-[var(--txt3)] text-xs font-medium text-center">
              Don't have a secure ID?{' '}
              <Link to="/signup" className="text-[var(--gold-acc)] font-bold hover:underline ml-1">Create Account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
