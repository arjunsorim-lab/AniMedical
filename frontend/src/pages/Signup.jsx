import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiUser, HiMail, HiLockClosed, HiArrowRight, HiIdentification, HiSparkles, HiEye, HiEyeOff } from 'react-icons/hi';
import useAuthStore from '../store/useAuthStore';
import { isPasswordStrong } from '../utils/validation';

export default function Signup() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signup, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, username, email, password, confirmPassword } = formData;

    if (!name || !username || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const validation = isPasswordStrong(password);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    try {
      await signup({ name, username, email, password });
      toast.success('Neural Link Established');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[var(--bg)] overflow-y-auto">

      {/* ── Left Side: Immersive Hero Area (Hidden on Mobile) ── */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-[40%] relative overflow-hidden bg-[var(--bg2)] border-r border-[var(--brd)]">
        <img
          src="/images/auth-hero.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 scale-110 animate-pulse"
          style={{ animationDuration: '10s', transformOrigin: 'top right' }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[var(--bg2)]/80 via-transparent to-transparent" />

        {/* Content in Hero */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="var(--bg)" strokeWidth="3" />
                <path d="M20 8V16M24 23L33 28M16 23L7 28" stroke="var(--bg)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-2xl font-black text-[var(--txt)] tracking-tighter">AniCare Vox</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black text-[var(--txt)] leading-tight tracking-tighter mb-3">
              Join the <br />
              <span className="text-gold-gradient">Intelligent Core.</span>
            </h2>
            <p className="text-sm xl:text-base text-[var(--txt2)] leading-relaxed font-medium">
              Start your journey into the next generation of voice-first productivity.
            </p>
          </div>

          <div className="flex items-center gap-6 opacity-30">
            <span className="text-[10px] font-bold text-[var(--txt)] uppercase tracking-[0.4em]">Encrypted Connection Active</span>
          </div>
        </div>
      </div>

      {/* ── Right Side: Professional Signup Pane ── */}
      <div className="flex-1 flex flex-col justify-start items-start px-8 sm:px-16 lg:px-20 xl:px-32 bg-[var(--bg)] relative overflow-y-auto min-h-screen pt-12 pb-12">
        <div className="w-full max-w-[460px] animate-fade-in-scale">
          {/* Top Branding */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shadow-lg shadow-gold-600/20">
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="var(--bg)" strokeWidth="4" />
                <path d="M20 8V16M24 23L33 28M16 23L7 28" stroke="var(--bg)" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-black text-[var(--txt)] tracking-tighter">AniCare Vox</span>
          </div>

          <div className="mb-4">
            <h3 className="text-2xl font-black text-[var(--txt)] tracking-tighter mb-1">Create Username</h3>
            <p className="text-[var(--txt3)] text-[10px] font-medium uppercase tracking-wider">Initialize your unique neural signature.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.2em] ml-1">Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                    <HiUser className="text-xl" />
                  </div>
                  <input
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 bg-[var(--brd)] border border-[var(--brd2)] rounded-xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all text-sm"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.2em] ml-1">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                    <HiIdentification className="text-xl" />
                  </div>
                  <input
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-4 bg-[var(--brd)] border border-[var(--brd2)] rounded-xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all text-sm"
                    placeholder="john_voxa"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                  <HiMail className="text-lg" />
                </div>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-4 bg-[var(--brd)] border border-[var(--brd2)] rounded-xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all text-sm"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Access Key */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-widest ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                    <HiLockClosed className="text-lg" />
                  </div>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-12 py-4 bg-[var(--brd)] border border-[var(--brd2)] rounded-xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all text-sm"
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

              {/* Verify Key */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-widest ml-1">Verify Key</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                    <HiLockClosed className="text-lg" />
                  </div>
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-12 pr-12 py-4 bg-[var(--brd)] border border-[var(--brd2)] rounded-xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all text-sm"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--txt3)] hover:text-[var(--gold-acc)] transition-colors"
                  >
                    {showConfirmPassword ? <HiEyeOff className="text-xl" /> : <HiEye className="text-xl" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  required
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-[var(--brd2)] bg-[var(--brd)] transition-all checked:bg-[var(--gold-acc)] focus:outline-none"
                />
                <svg
                  className="absolute h-3.5 w-3.5 pointer-events-none left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity text-black"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <label className="text-[10px] font-medium text-[var(--txt3)] uppercase tracking-widest cursor-pointer">
                I agree to the <span className="text-[var(--gold-acc)] font-bold hover:underline">Terms & Conditions</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="animate-shine w-full flex items-center justify-center py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#3B82F6] via-[#BFDBFE] to-[#1D4ED8] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-600/20 group disabled:opacity-50 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-[#0B0B0F] font-black text-[11px] uppercase tracking-[0.3em]">Initialize Link</span>
                  <HiArrowRight className="text-[#0B0B0F] text-xl group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--txt3)] text-xs font-medium">
              Already have an Username?{' '}
              <Link to="/login" className="text-[var(--gold-acc)] font-bold hover:underline ml-1">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
