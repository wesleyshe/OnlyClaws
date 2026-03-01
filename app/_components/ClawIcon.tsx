export default function ClawIcon({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gear body */}
      <circle cx="24" cy="36" r="12" stroke="currentColor" strokeWidth="3" fill="none" />
      <circle cx="24" cy="36" r="5" fill="currentColor" opacity="0.3" />
      {/* Gear teeth */}
      <rect x="22" y="21" width="4" height="5" rx="1" fill="currentColor" />
      <rect x="22" y="48" width="4" height="5" rx="1" fill="currentColor" />
      <rect x="9" y="34" width="5" height="4" rx="1" fill="currentColor" />
      <rect x="34" y="34" width="5" height="4" rx="1" fill="currentColor" />
      {/* Gear diagonal teeth */}
      <rect x="12.5" y="24" width="4" height="5" rx="1" fill="currentColor" transform="rotate(-45 14.5 26.5)" />
      <rect x="31.5" y="43" width="4" height="5" rx="1" fill="currentColor" transform="rotate(-45 33.5 45.5)" />
      <rect x="31.5" y="24" width="4" height="5" rx="1" fill="currentColor" transform="rotate(45 33.5 26.5)" />
      <rect x="12.5" y="43" width="4" height="5" rx="1" fill="currentColor" transform="rotate(45 14.5 45.5)" />
      {/* Upper claw arm - left prong */}
      <path
        d="M28 26 L34 16 L38 8 L36 6 L30 10 L26 18"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Upper claw arm - right prong */}
      <path
        d="M34 30 L42 22 L50 16 L52 18 L48 24 L40 30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Claw tips */}
      <circle cx="36" cy="6" r="2.5" fill="currentColor" />
      <circle cx="52" cy="17" r="2.5" fill="currentColor" />
    </svg>
  );
}
