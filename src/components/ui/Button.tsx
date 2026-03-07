import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-semibold transition-all duration-200 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#1e3a8a] hover:bg-[#3b82f6] text-white focus:ring-[#3b82f6]',
    secondary: 'bg-[#1a1a2e] border border-[#c9a84c]/30 hover:border-[#c9a84c] text-[#c9a84c] hover:bg-[#c9a84c]/10 focus:ring-[#c9a84c]',
    danger: 'bg-[#8b0000] hover:bg-[#c41e3a] text-white focus:ring-[#c41e3a]',
    ghost: 'bg-transparent hover:bg-white/5 text-gray-300 hover:text-white border border-white/10 hover:border-white/30 focus:ring-white/30',
    gold: 'bg-[#c9a84c] hover:bg-[#e8c76a] text-[#0a0a0f] font-bold shadow-[0_0_15px_rgba(201,168,76,0.3)] hover:shadow-[0_0_25px_rgba(201,168,76,0.5)] focus:ring-[#c9a84c]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
