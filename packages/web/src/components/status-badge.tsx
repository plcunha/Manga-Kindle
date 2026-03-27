const STATUS_STYLES: Record<string, string> = {
  queued: "bg-gray-600/20 text-gray-400",
  downloading: "bg-blue-600/20 text-blue-400",
  processing: "bg-blue-600/20 text-blue-400",
  completed: "bg-green-600/20 text-green-400",
  failed: "bg-red-600/20 text-red-400",
  cancelled: "bg-yellow-600/20 text-yellow-400",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.queued;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}
