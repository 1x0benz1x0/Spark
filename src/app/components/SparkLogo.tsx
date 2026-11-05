"use client";

export function SparkLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 C55 25 60 38 95 50 C60 62 55 75 50 95 C45 75 40 62 5 50 C40 38 45 25 50 5 Z" fill="white" />
    </svg>
  );
}
