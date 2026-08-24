import React from "react";

export function MunicipalCrest({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="crestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <path
        d="M50 8 L82 22 C82 58 50 88 50 92 C50 88 18 58 18 22 Z"
        fill="url(#crestGrad)"
        stroke="#ffffff"
        strokeWidth="3"
        className="drop-shadow-md"
      />
      <circle cx="50" cy="32" r="10" fill="url(#goldGrad)" />
      <path
        d="M50 16 L50 20 M50 44 L50 48 M34 32 L38 32 M62 32 L66 32 M38 20 L41 23 M59 41 L62 44 M38 44 L41 41 M59 23 L62 20"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M28 48 C28 62 38 72 50 78"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 4"
        opacity="0.8"
      />
      <path
        d="M72 48 C72 62 62 72 50 78"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 4"
        opacity="0.8"
      />
      <path
        d="M44 48 L56 48 L56 68 L44 68 Z M40 68 L60 68 M47 48 L50 42 L53 48"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
