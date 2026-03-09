interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

import React from 'react';

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="border-b border-[#c9a84c]/20 bg-[#0a0a0f]/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-bold text-white tracking-wide">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
