import Link from 'next/link';

type PhoenixBrandProps = {
  compact?: boolean;
  href?: string;
};

export function PhoenixBrand({ compact = false, href = '/dashboard' }: PhoenixBrandProps) {
  return (
    <Link href={href} className="phoenix-brand" aria-label="Phoenix Creator Studio home">
      <span className="phoenix-mark" aria-hidden="true">
        <span className="phoenix-wing phoenix-wing-left" />
        <span className="phoenix-core">P</span>
        <span className="phoenix-wing phoenix-wing-right" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="phoenix-brand-kicker">Bobby&apos;s Workshop presents</span>
          <span className="phoenix-brand-name">Phoenix Creator Studio</span>
          <span className="phoenix-brand-line">Write it. Build it. Bring it to life.</span>
        </span>
      )}
    </Link>
  );
}
