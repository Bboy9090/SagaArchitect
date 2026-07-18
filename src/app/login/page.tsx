'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (res?.error) {
          setError(res.error || 'Invalid credentials.');
        } else {
          router.push('/dashboard');
          router.refresh();
        }
      } catch {
        setError('An unexpected error occurred.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#030303] text-gray-100 flex items-center justify-center p-4 selection:bg-[#c9a84c] selection:text-black">
      {/* Background ambient highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#c9a84c]/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl relative">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-300 to-[#c9a84c] bg-clip-text text-transparent">
            SagaArchitect
          </h1>
          <p className="text-xs text-gray-500 mt-2 font-mono uppercase tracking-widest">
            Phoenix Creator Studio
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-950/40 border border-red-500/40 text-red-400 text-xs rounded-lg text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/60 transition-all text-white placeholder-gray-600"
              placeholder="writer@saga.com"
              disabled={isPending}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/60 transition-all text-white placeholder-gray-600"
              placeholder="••••••••"
              disabled={isPending}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-r from-[#e5c158] to-[#c9a84c] text-black font-bold py-3 px-4 rounded-xl hover:from-[#f0cd6d] hover:to-[#dbb958] transition-all text-sm shadow-lg shadow-[#c9a84c]/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Signing In...' : 'Enter Workspace'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-gray-500">
          <span>Need an account? </span>
          <Link href="/register" className="text-[#c9a84c] hover:underline font-medium ml-1">
            Create One
          </Link>
        </div>
      </div>
    </div>
  );
}
