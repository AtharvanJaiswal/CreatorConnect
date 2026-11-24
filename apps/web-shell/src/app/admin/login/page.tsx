'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../providers/auth-provider';
import { CcLogoSquare } from '../../../components/ui/cc-brand';
import { AdminInput } from '../../../components/admin/ui/AdminInput';
import { AdminButton } from '../../../components/admin/ui/AdminButton';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both your staff email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(email, password);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        router.push('/admin/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] flex flex-col justify-center items-center p-4 sm:p-8 font-sans-body">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E7E0D5] p-8 shadow-[0_16px_48px_rgba(20,17,15,0.06)]">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <CcLogoSquare size="lg" className="rounded-2xl mb-4 shadow-xs" />
          <h1 className="text-2xl font-extrabold text-[#14110F] tracking-tight font-sans-body">
            Admin Web Console
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1 font-sans-body">
            Authorized operations, moderation, and finance access
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-[#FBE9E7] border border-[#F6C4C0] flex items-start gap-3 text-xs text-[#D8483C]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Hardened Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AdminInput
            label="Staff Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@creatorconnect.in"
            icon={<Mail className="w-4 h-4" />}
            required
            autoFocus
          />

          <AdminInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            icon={<Lock className="w-4 h-4" />}
            required
          />

          <div className="pt-2">
            <AdminButton
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              className="w-full shadow-sm text-sm font-bold"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Authenticate & Enter
            </AdminButton>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-[#EFE9DF] text-center">
          <p className="text-[11px] text-[#A39A8F]">
            CreatorConnect Platform Administration • Restricted Access Only
          </p>
        </div>
      </div>
    </div>
  );
}
