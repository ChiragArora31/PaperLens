import { useId } from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export default function BrandMark({ size = 44, className }: BrandMarkProps) {
  const gradientId = useId().replace(/:/g, '');
  const panelId = `${gradientId}-panel`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={panelId} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F2F2F2" />
        </linearGradient>
      </defs>

      <rect
        x="6.5"
        y="6.5"
        width="51"
        height="51"
        rx="16"
        fill={`url(#${panelId})`}
        stroke="#121212"
        strokeWidth="1.4"
      />

      <path
        d="M22 18.5H35.2L43.5 26.8V43.5C43.5 46.5 41.1 49 38.1 49H22.9C19.9 49 17.5 46.5 17.5 43.5V24C17.5 21 19.9 18.5 22.9 18.5H22Z"
        stroke="#111111"
        strokeOpacity="0.9"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M35 18.8V26.5H42.7"
        stroke="#111111"
        strokeOpacity="0.78"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="29.6"
        cy="35.3"
        r="5.8"
        stroke="#111111"
        strokeWidth="2.2"
      />
      <path
        d="M33.8 39.5L39.6 45.2"
        stroke="#111111"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
