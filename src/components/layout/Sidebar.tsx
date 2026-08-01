'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { PhoenixBrand } from '@/components/brand/PhoenixBrand';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function Sidebar() {
  const params = useParams();
  const pathname = usePathname();
  const universeId = params?.id as string | undefined;

  const mainNav: NavItem[] = [
    { href: '/dashboard', label: 'Studio Home', icon: '⌂' },
    { href: '/universe/new', label: 'Start Production', icon: '✦' },
    { href: '/shared-lore-pool', label: 'Creative Vault', icon: '◇' },
  ];

  const universeNav: NavItem[] = universeId ? [
    { href: `/universe/${universeId}`, label: 'Project Bible', icon: '◎' },
    { href: `/universe/${universeId}/characters`, label: 'Characters', icon: '👤' },
    { href: `/universe/${universeId}/scenes`, label: 'Scenes', icon: '🎬' },
    { href: `/universe/${universeId}/storyboard`, label: 'Storyboard', icon: '🖼️' },
    { href: `/universe/${universeId}/factions`, label: 'Factions', icon: '🏛️' },
    { href: `/universe/${universeId}/timeline`, label: 'Timeline', icon: '⏳' },
    { href: `/universe/${universeId}/arcs`, label: 'Story Arcs', icon: '⌁' },
    { href: `/universe/${universeId}/lore`, label: 'World Bible', icon: '◈' },
    { href: `/universe/${universeId}/stories`, label: 'Writing Room', icon: '✎' },
    { href: `/universe/${universeId}/export`, label: 'Publish & Export', icon: '⇩' },
    { href: `/universe/${universeId}/history`, label: 'Production History', icon: '↺' },
  ] : [];

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="w-72 min-h-screen bg-[#060a17]/95 backdrop-blur-xl border-r border-blue-400/15 flex flex-col">
      <div className="p-5 border-b border-blue-400/15">
        <PhoenixBrand />
      </div>

      <nav className="p-3 flex-1">
        <div className="mb-6">
          <p className="text-[10px] text-blue-300/40 uppercase tracking-[.22em] mb-2 px-2">Studio</p>
          {mainNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-all duration-150 mb-1
                ${isActive(item.href)
                  ? 'bg-blue-400/10 text-blue-300 border border-blue-400/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}
              `}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.label === 'Shared Lore Pool' && (
                <span className="ml-auto text-[9px] text-[#c9a84c]/60 bg-[#c9a84c]/10 rounded px-1.5 py-0.5 uppercase tracking-wider">
                  new
                </span>
              )}
            </Link>
          ))}
        </div>

        {universeNav.length > 0 && (
          <div>
            <p className="text-[10px] text-violet-300/40 uppercase tracking-[.22em] mb-2 px-2">Active Production</p>
            {universeNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-all duration-150 mb-1
                  ${isActive(item.href)
                    ? 'bg-violet-400/10 text-violet-200 border border-violet-400/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'}
                `}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.label === 'Story Forge' && (
                  <span className="ml-auto text-[9px] text-[#c9a84c]/60 bg-[#c9a84c]/10 rounded px-1.5 py-0.5 uppercase tracking-wider">
                    new
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-[#c9a84c]/10 flex flex-col gap-2">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-400 hover:bg-red-500/5 rounded transition-all cursor-pointer"
        >
          <span>🚪</span> Sign Out
        </button>

        <div className="flex items-center gap-1.5 px-1 justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-blue-300/50">●</span>
            <span className="text-[10px] text-gray-600 tracking-wider uppercase">Studio systems online</span>
          </div>
        </div>
        <p className="text-[9px] text-gray-700 text-center tracking-widest uppercase">A Bobby&apos;s Workshop production</p>
      </div>
    </aside>
  );
}
