"use client";

export type AniExpression = "happy" | "excited" | "thinking";

export default function AniGuide({
  expression = "happy",
  size = 80,
  className = "",
}: {
  expression?: AniExpression;
  size?: number;
  className?: string;
}) {
  const w = size;
  const h = size * 1.15;

  const eyeRy = expression === "excited" ? 5.5 : 5;
  const mouthD = expression === "excited" ? "M 42 52 Q 50 60 58 52" : expression === "thinking" ? "M 44 52 Q 50 56 56 50" : "M 44 52 Q 50 58 56 52";
  const browLeftY = expression === "thinking" ? 30 : 32;
  const browRightY = expression === "thinking" ? 28 : 32;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 115"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {expression === "excited" && (
        <>
          <line x1="18" y1="22" x2="12" y2="16" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
          <line x1="82" y1="22" x2="88" y2="16" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="28" x2="14" y2="26" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="80" y1="28" x2="86" y2="26" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {/* Hair */}
      <path
        d="M 28 38 C 22 28 25 12 40 8 C 50 4 62 8 68 18 C 78 12 88 22 85 38 C 88 42 86 48 82 50"
        fill="#78350f"
        stroke="#5c2d0a"
        strokeWidth="1"
      />
      <path d="M 30 40 L 26 48 L 32 44 Z" fill="#92400e" />
      <path d="M 72 38 L 78 46 L 70 44 Z" fill="#92400e" />

      {/* Face */}
      <ellipse cx="50" cy="48" rx="28" ry="30" fill="#fde4d0" stroke="#e8c4a8" strokeWidth="1.2" />

      {/* Blush */}
      <ellipse cx="36" cy="52" rx="5" ry="3" fill="#fca5a5" opacity="0.35" />
      <ellipse cx="64" cy="52" rx="5" ry="3" fill="#fca5a5" opacity="0.35" />

      {/* Eyebrows */}
      <path
        d={`M 36 ${browLeftY} Q 40 ${browLeftY - 2} 44 ${browLeftY}`}
        stroke="#5c2d0a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M 56 ${browRightY} Q 60 ${browRightY - 3} 64 ${browRightY}`}
        stroke="#5c2d0a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Eyes */}
      <ellipse cx="40" cy="40" rx={eyeRy} ry={expression === "excited" ? 6.5 : 5.5} fill="white" stroke="#374151" strokeWidth="1.2" />
      <ellipse cx="60" cy="40" rx={eyeRy} ry={expression === "excited" ? 6.5 : 5.5} fill="white" stroke="#374151" strokeWidth="1.2" />
      <circle cx="41" cy="41" r="3" fill="#1f2937" />
      <circle cx="61" cy="41" r="3" fill="#1f2937" />
      <circle cx="42.2" cy="39.5" r="1.1" fill="white" />
      <circle cx="62.2" cy="39.5" r="1.1" fill="white" />

      {/* Nose */}
      <ellipse cx="50" cy="48" rx="2" ry="1.5" fill="#e8c4a8" opacity="0.6" />

      {/* Mouth */}
      <path d={mouthD} stroke="#7c2d12" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Thinking: finger hint */}
      {expression === "thinking" && (
        <path
          d="M 72 62 Q 78 58 80 52 Q 82 48 78 46"
          stroke="#fde4d0"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Simple body */}
      <path
        d="M 32 78 Q 50 72 68 78 L 72 108 Q 50 112 28 108 Z"
        fill="#3b82f6"
        stroke="#2563eb"
        strokeWidth="1"
      />
      <path d="M 28 85 L 22 95 L 30 92 Z" fill="#fde4d0" />
    </svg>
  );
}
