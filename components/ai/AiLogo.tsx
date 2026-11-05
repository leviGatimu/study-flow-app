import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Study AI's logo: the app's cube (public/logo.png), shaded, with a spark
 * at its corner, on a squircle in the main colour. It follows the chosen
 * accent because every colour comes from --primary.
 *
 * `thinking` turns the spark slowly and lifts the cube's top face, for the
 * moment the AI is working on a reply. Both stop under reduced motion.
 */
export function AiLogo({
  size = 32,
  thinking = false,
  className,
  title,
}: {
  size?: number;
  thinking?: boolean;
  className?: string;
  /** Give a title when the logo stands alone; otherwise it is decorative. */
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'color-mix(in oklch, var(--primary) 78%, white)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in oklch, var(--primary) 82%, black)' }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-bg)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="white" strokeOpacity="0.18" />

      {/* The cube, lit from the top left. */}
      <g className={cn(thinking && 'ai-logo-lift')}>
        <path d="M15 8.4 22.6 12.8 15 17.2 7.4 12.8Z" fill="white" fillOpacity="0.96" />
        <path d="M7.4 12.8 15 17.2V26L7.4 21.6Z" fill="white" fillOpacity="0.62" />
        <path d="M22.6 12.8V21.6L15 26V17.2Z" fill="white" fillOpacity="0.34" />
      </g>

      {/* The spark. */}
      <path
        d="M24.5 3.6C24.9 6 25.6 6.7 28 7.1 25.6 7.5 24.9 8.2 24.5 10.6 24.1 8.2 23.4 7.5 21 7.1 23.4 6.7 24.1 6 24.5 3.6Z"
        fill="white"
        className={cn(thinking && 'ai-logo-spark')}
        style={{ transformOrigin: '24.5px 7.1px', transformBox: 'view-box' }}
      />
    </svg>
  );
}
