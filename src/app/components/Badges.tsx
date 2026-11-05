export function CrownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#FFD700" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 16L3 5l5.5 5L12 2l3.5 8L21 5l-2 11H5z" stroke="#FFD700" strokeWidth="1" strokeLinejoin="round" />
      <rect x="5" y="17" width="14" height="2" rx="1" fill="#FFD700" />
    </svg>
  );
}

export function VerifiedBadge({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Blue circle background */}
      <circle cx="12" cy="12" r="10" fill="#20D5EC" />
      {/* White checkmark */}
      <path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function AdminBadge({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#A855F7" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#A855F7" />
    </svg>
  );
}
