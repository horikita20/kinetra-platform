import React from "react";

interface KinectraLogoProps {
  className?: string;
}

export function KinectraLogo({ className = "w-8 h-8" }: KinectraLogoProps) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Dark slate hexagon background */}
      <path
        d="M 60 8 L 95 28 L 95 72 L 60 92 L 25 72 L 25 28 Z"
        fill="#090d16"
        stroke="#1e293b"
        strokeWidth="1.5"
      />

      {/* Red cricket ball */}
      <circle cx="60" cy="50" r="13" fill="#dc2626" />
      
      {/* Seam curves */}
      <path
        d="M 55 38.5 Q 60 50 55 61.5"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1"
        strokeDasharray="1.5 1.5"
        fill="none"
      />
      <path
        d="M 65 38.5 Q 60 50 65 61.5"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1"
        strokeDasharray="1.5 1.5"
        fill="none"
      />

      {/* Blue bounding/targeting corners */}
      <path d="M 49 35 H 44 V 40" stroke="#00d2ff" strokeWidth="1.5" fill="none" />
      <path d="M 71 35 H 76 V 40" stroke="#00d2ff" strokeWidth="1.5" fill="none" />
      <path d="M 49 65 H 44 V 60" stroke="#00d2ff" strokeWidth="1.5" fill="none" />
      <path d="M 71 65 H 76 V 60" stroke="#00d2ff" strokeWidth="1.5" fill="none" />

      {/* Golden bat handle / bail on left */}
      <rect x="13" y="38" width="5" height="18" rx="1.5" fill="#C49A45" />
      <rect x="15" y="28" width="1" height="10" fill="#EAD293" />
      
      {/* Speed lines from left */}
      <path d="M 16 47 H 23" stroke="#00d2ff" strokeWidth="1" opacity="0.6" />
      <path d="M 14 50 H 22" stroke="#00d2ff" strokeWidth="1" opacity="0.6" />
      <path d="M 16 53 H 23" stroke="#00d2ff" strokeWidth="1" opacity="0.6" />

      {/* Speed curves entering hexagon */}
      <path
        d="M 23 47 Q 35 44 45 47 M 22 50 Q 35 48 45 50 M 23 53 Q 35 52 45 53"
        stroke="#00d2ff"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />

      {/* Wickets on the right */}
      <rect x="99" y="44" width="2" height="14" rx="0.5" fill="#E2E8F0" opacity="0.8" />
      <rect x="103" y="44" width="2" height="14" rx="0.5" fill="#E2E8F0" opacity="0.8" />
      <rect x="107" y="44" width="2" height="14" rx="0.5" fill="#E2E8F0" opacity="0.8" />
      
      {/* Red bails */}
      <rect x="98" y="42.5" width="12" height="1.5" rx="0.5" fill="#EF4444" opacity="0.9" />

      {/* Dotted arrow pointing to wickets */}
      <path
        d="M 78 50 H 94"
        stroke="#00d2ff"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        fill="none"
      />
      <polygon points="93,48.5 96,50 93,51.5" fill="#00d2ff" />
    </svg>
  );
}
