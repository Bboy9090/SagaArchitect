import type { CanonStatus } from '@/lib/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'canon' | 'draft' | 'alternate' | 'deprecated' | 'mystery' | 'default' | 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantClasses = {
  canon: 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/40',
  draft: 'bg-[#1e3a8a]/40 text-[#3b82f6] border border-[#3b82f6]/40',
  alternate: 'bg-purple-900/40 text-purple-300 border border-purple-500/40',
  deprecated: 'bg-gray-800/60 text-gray-400 border border-gray-600/40',
  mystery: 'bg-[#8b0000]/40 text-[#c41e3a] border border-[#c41e3a]/40',
  default: 'bg-white/10 text-gray-300 border border-white/20',
  info: 'bg-[#1e3a8a]/40 text-[#3b82f6] border border-[#3b82f6]/40',
  success: 'bg-green-900/40 text-green-400 border border-green-500/40',
  warning: 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/40',
  danger: 'bg-[#8b0000]/40 text-[#c41e3a] border border-[#c41e3a]/40',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function CanonBadge({ status }: { status: CanonStatus }) {
  const labels: Record<CanonStatus, string> = {
    canon: '⚡ Canon',
    draft: '✏️ Draft',
    alternate: '🔀 Alternate',
    deprecated: '🚫 Deprecated',
    mystery: '🔮 Mystery',
  };
  return <Badge variant={status}>{labels[status]}</Badge>;
}
