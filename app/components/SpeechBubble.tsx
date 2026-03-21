"use client";

export default function SpeechBubble({
  text,
  direction = "left",
  visible,
  className = "",
}: {
  text: string;
  direction?: "left" | "right";
  visible: boolean;
  className?: string;
}) {
  const tail =
    direction === "left"
      ? "before:left-4 before:border-r-white before:border-r-[10px] before:border-y-transparent before:border-y-[8px] before:border-l-0"
      : "before:right-4 before:border-l-white before:border-l-[10px] before:border-y-transparent before:border-y-[8px] before:border-r-0";

  return (
    <div
      className={`relative max-w-[280px] rounded-2xl bg-white px-4 py-3 text-base leading-snug text-gray-800 shadow-md transition-all duration-500 ease-out before:absolute before:top-full before:h-0 before:w-0 before:border-solid before:content-[''] ${tail} ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
      } ${className}`}
      role="status"
    >
      {text.split("\n").map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </div>
  );
}
