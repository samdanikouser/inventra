'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import api, { endpoints } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post(endpoints.token, { username, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      // Force reload so AuthProvider re-fetches /me with the new token.
      window.location.href = '/';
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid credentials. Please check your username and password.');
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-xl shadow-black/10">
            <Package className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Inventra</h1>
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Enterprise OS</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-10 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-[#1A1A1A]">Welcome back</h2>
            <p className="text-sm text-[#6B7280]">Sign in to access the inventory management system</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl"
            >
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <p className="text-xs font-medium text-rose-700">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-[#E5E7EB] rounded-2xl font-bold text-sm outline-none focus:border-black transition-colors"
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-[#E5E7EB] rounded-2xl font-bold text-sm outline-none focus:border-black transition-colors pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-black/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mt-8">
          Inventra © {new Date().getFullYear()} • Secure Access
        </p>
      </motion.div>
    </div>
  );
}
