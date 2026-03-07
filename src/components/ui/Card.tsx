import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: boolean;
}

export function Card({ children, className = '', onClick, glow = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[#0f0f1a] border border-[#c9a84c]/20 rounded-lg p-4
        ${glow ? 'shadow-[0_0_20px_rgba(201,168,76,0.1)]' : ''}
        ${onClick ? 'cursor-pointer hover:border-[#c9a84c]/50 hover:shadow-[0_0_20px_rgba(201,168,76,0.15)] transition-all duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}
export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}
export function CardTitle({ children, className = '' }: CardTitleProps) {
  return <h3 className={`text-lg font-bold text-white ${className}`}>{children}</h3>;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}
export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`text-gray-400 text-sm ${className}`}>{children}</div>;
}
