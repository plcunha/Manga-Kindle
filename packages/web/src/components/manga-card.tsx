import Link from "next/link";
import type { MangaInfo } from "@/lib/api";

interface MangaCardProps {
  manga: MangaInfo;
  sourceId: string;
}

export function MangaCard({ manga, sourceId }: MangaCardProps) {
  return (
    <Link
      href={`/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(manga.id)}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-surface-50 transition-colors hover:border-accent/40"
    >
      {/* Cover */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-surface-100">
        {manga.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-600">
            No Cover
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight text-gray-200">
          {manga.title}
        </h3>
        {manga.status && (
          <span className="text-xs text-gray-500">{manga.status}</span>
        )}
        {manga.genres && manga.genres.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {manga.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="rounded bg-surface-200 px-1.5 py-0.5 text-[10px] text-gray-400"
              >
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
