import { cn } from '../lib/utils';

type Platform = 'sx' | 'polymarket';

interface VenueLogoProps {
  platform: Platform;
  size?: number;
  className?: string;
}

export function VenueLogo({ platform, size = 14, className }: VenueLogoProps) {
  // Polymarket's source PNG has internal padding around the artwork, so it visually
  // renders ~60% the size of the SX mark at the same box. Scale it up via transform
  // so the layout box stays the same width across platforms.
  const src = platform === 'sx' ? '/sx_icon_large.png' : '/icon-white.png';
  const alt = platform === 'sx' ? 'SX Bet' : 'Polymarket';
  const scale = platform === 'polymarket' ? 1.6 : 1;
  return (
    <span
      className={cn('inline-flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size, transform: scale === 1 ? undefined : `scale(${scale})` }}
        className="inline-block object-contain"
      />
    </span>
  );
}
