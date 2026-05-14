import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { HiMail, HiLockClosed, HiArrowLeft, HiSparkles, HiCheckCircle, HiEye, HiEyeOff } from 'react-icons/hi';
import useAuthStore from '../store/useAuthStore';
import { isPasswordStrong } from '../utils/validation';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const { updatePassword, loading } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!username || !oldPassword || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    const validation = isPasswordStrong(password);
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    try {
      await updatePassword(username, oldPassword, password);
      toast.success('Neural key updated');
      navigate('/login');
    } catch (err) {
      toast.error(err.message || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[var(--bg)] overflow-y-auto">
      
      {/* ── Left Side: Immersive Hero Area ── */}
      <div className="hidden lg:flex lg:w-2/5 xl:w-[45%] relative overflow-hidden bg-[var(--bg2)] border-r border-[var(--brd)]">
        <img
          src="/images/auth-hero.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg2)]/60 to-[var(--bg)]" />
        
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-16">
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--brd)] border border-[var(--brd2)] mb-6 backdrop-blur-md">
              <HiSparkles className="text-[var(--gold-acc)]" />
              <span className="text-[10px] font-bold text-[var(--txt2)] uppercase tracking-[0.2em]">Security Protocol 7-A</span>
            </div>
            <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black text-[var(--txt)] leading-tight tracking-tighter mb-4">
              Neural Key <br />
              <span className="text-gold-gradient">Update.</span>
            </h2>
            <p className="text-sm sm:text-base text-[var(--txt2)] leading-relaxed font-medium max-w-md">
              Verify your current credentials to establish a new encrypted neural access key.
            </p>
          </div>

          <div className="flex items-center gap-4 opacity-20">
            <div className="h-px flex-1 bg-[var(--txt3)]" />
            <span className="text-[9px] font-bold text-[var(--txt3)] uppercase tracking-[0.5em]">Identity Verification</span>
            <div className="h-px flex-1 bg-[var(--txt3)]" />
          </div>
        </div>
      </div>

      {/* ── Right Side: Reset Pane ── */}
      <div className="flex-1 flex flex-col justify-center items-start px-8 sm:px-16 lg:px-24 bg-[var(--bg)] relative overflow-y-auto hide-scrollbar min-h-screen pt-12 pb-12">
        
        <div className="w-full max-w-[400px] animate-fade-in-scale flex flex-col gap-8">
          {/* Top Branding */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shadow-lg shadow-gold-600/20">
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="16" stroke="var(--bg)" strokeWidth="4" />
                <path d="M20 8V16M24 23L33 28M16 23L7 28" stroke="var(--bg)" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-black text-[var(--txt)] tracking-tighter">AniCare Vox</span>
          </div>

          <div className="w-full">
              <div className="mb-4">
                <h3 className="text-2xl font-black text-[var(--txt)] tracking-tighter mb-1">Update Password</h3>
                <p className="text-[var(--txt3)] text-[10px] font-medium uppercase tracking-wider">Provide your credentials to establish a new key.</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.25em] ml-1">Username or Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                      <HiMail className="text-xl" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[var(--brd)] border border-[var(--brd2)] rounded-2xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all"
                      placeholder="Username or email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.25em] ml-1">Current Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                      <HiLockClosed className="text-xl" />
                    </div>
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-[var(--brd)] border border-[var(--brd2)] rounded-2xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all"
                      placeholder="Old password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--txt3)] hover:text-[var(--gold-acc)] transition-colors"
                    >
                      {showOldPassword ? <HiEyeOff className="text-xl" /> : <HiEye className="text-xl" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="h-px bg-[var(--brd)] w-full mb-4" />
                  <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.25em] ml-1">New Access Key</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                      <HiLockClosed className="text-xl" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-[var(--brd)] border border-[var(--brd2)] rounded-2xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all"
                      placeholder="New password"
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

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[var(--txt3)] uppercase tracking-[0.25em] ml-1">Verify New Key</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--txt3)] group-focus-within:text-[var(--gold-acc)] transition-colors">
                      <HiLockClosed className="text-xl" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-3 bg-[var(--brd)] border border-[var(--brd2)] rounded-2xl text-[var(--txt)] placeholder-[var(--txt3)]/30 focus:outline-none focus:border-[var(--gold-acc)]/40 focus:bg-[var(--sb-hover)] transition-all"
                      placeholder="Confirm new password"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="animate-shine w-full flex items-center justify-center py-5 px-6 rounded-2xl bg-gradient-to-r from-[#3B82F6] via-[#BFDBFE] to-[#1D4ED8] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-gold-600/20 group disabled:opacity-50 mt-4"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <span className="text-[#0B0B0F] font-black text-[11px] uppercase tracking-[0.3em]">
                      Update Access Key
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-[var(--brd)] text-center">
                <Link to="/login" className="text-[var(--txt3)] text-xs font-bold hover:text-[var(--gold-acc)] transition-colors inline-flex items-center gap-2">
                  <HiArrowLeft /> Return to Login
                </Link>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
