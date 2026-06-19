'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, usePathname } from 'next/navigation';

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
    { href: '/dashboard', label: 'Projects', icon: '🏛️' },
    { href: '/universe/new', label: 'New Project', icon: '✨' },
    { href: '/shared-lore-pool', label: 'Shared Lore Pool', icon: '🌐' },
  ];

  const universeNav: NavItem[] = universeId ? [
    { href: `/universe/${universeId}`, label: 'Canon Engine', icon: '🌍' },
    { href: `/universe/${universeId}/characters`, label: 'Characters', icon: '👤' },
    { href: `/universe/${universeId}/scenes`, label: 'Scenes', icon: '🎬' },
    { href: `/universe/${universeId}/storyboard`, label: 'Storyboard', icon: '🖼️' },
    { href: `/universe/${universeId}/factions`, label: 'Factions', icon: '🏛️' },
    { href: `/universe/${universeId}/timeline`, label: 'Timeline', icon: '⏳' },
    { href: `/universe/${universeId}/arcs`, label: 'Arc Forge', icon: '⚔️' },
    { href: `/universe/${universeId}/lore`, label: 'Lore Memory', icon: '🔮' },
    { href: `/universe/${universeId}/stories`, label: 'Story Forge', icon: '📖' },
    { href: `/universe/${universeId}/export`, label: 'Export', icon: '📥' },
  ] : [];

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="w-64 min-h-screen bg-[#0a0a0f] border-r border-[#c9a84c]/20 flex flex-col">
      <div className="p-4 border-b border-[#c9a84c]/20">
        <Link href="/dashboard" className="block flex flex-col items-center">
          <Image
            src="/sagaarchitect-logo.png"
            alt="Phoenix Creator Studio"
            width={160}
            height={160}
            className="w-24 h-24 object-contain"
            priority
          />
        </Link>
      </div>

      <nav className="p-3 flex-1">
        <div className="mb-6">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 px-2">Navigation</p>
          {mainNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-all duration-150 mb-1
                ${isActive(item.href)
                  ? 'bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30'
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
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 px-2">Project Context</p>
            {universeNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-all duration-150 mb-1
                  ${isActive(item.href)
                    ? 'bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30'
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

      <div className="p-3 border-t border-[#c9a84c]/10">
        {/* LoreEngine indicator */}
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="text-[10px] text-[#c9a84c]/40">⚡</span>
          <span className="text-[10px] text-gray-700 tracking-wider uppercase">LoreEngine v1</span>
        </div>
        <p className="text-[9px] text-gray-600 text-center tracking-widest uppercase">Phoenix Creator Studio</p>
      </div>
    </aside>
  );
}
