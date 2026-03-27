interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export function ProgressBar({ progress, className = "" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-200 ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
