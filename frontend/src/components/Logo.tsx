/**
 * Klypup brand logo. The wordmark is the real asset (public/logo.png); on the
 * dark terminal it's knocked out to white (.brand-logo filter in index.css),
 * full-color on light. LogoMark recreates the signature violet→green ascending
 * blade for compact spots (collapsed nav, favicon parity).
 */
export const BRAND_VIOLET = "#7c6cf2";
export const BRAND_GREEN = "#5fe39a";

export const LogoMark = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true"
    strokeLinecap="round" strokeWidth="3.4">
    <path d="M4 18.5 14.5 7" stroke={BRAND_VIOLET} />
    <path d="M10 20 20.5 5" stroke={BRAND_GREEN} />
  </svg>
);

/** Wordmark lockup. Set `compact` in tight spaces to show only the blade mark. */
export const Logo = ({ height = 22, compact = false, className = "" }: { height?: number; compact?: boolean; className?: string }) =>
  compact ? (
    <LogoMark size={height + 6} className={className} />
  ) : (
    // wrapper keeps the img from stretching when it's a flex child (align stretch)
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <img src="/logo.png" alt="klypup" className="brand-logo block w-auto max-w-none select-none" style={{ height }} draggable={false} />
    </span>
  );
