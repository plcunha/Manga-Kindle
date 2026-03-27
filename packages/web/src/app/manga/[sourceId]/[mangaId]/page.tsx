"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMangaDetail,
  startDownload,
  type MangaInfo,
  type ChapterInfo,
} from "@/lib/api";
import { ChapterList } from "@/components/chapter-list";

export default function MangaDetailPage() {
  const params = useParams<{ sourceId: string; mangaId: string }>();
  const router = useRouter();
  const sourceId = decodeURIComponent(params.sourceId);
  const mangaId = decodeURIComponent(params.mangaId);

  const [manga, setManga] = useState<MangaInfo | null>(null);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getMangaDetail(sourceId, mangaId)
      .then(({ manga: m, chapters: ch }) => {
        setManga(m);
        setChapters(ch);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load manga"),
      )
      .finally(() => setLoading(false));
  }, [sourceId, mangaId]);

  async function handleDownload(chapterIds: string[]) {
    if (!manga) return;
    setDownloading(true);
    try {
      await startDownload({
        sourceId,
        mangaId: manga.id,
        mangaTitle: manga.title,
        mangaCoverUrl: manga.coverUrl,
        chapterIds,
      });
      router.push("/downloads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
        {error}
      </p>
    );
  }

  if (!manga) return null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex gap-6">
        {/* Cover */}
        <div className="h-64 w-44 shrink-0 overflow-hidden rounded-lg bg-surface-100">
          {manga.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={manga.coverUrl}
              alt={manga.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-600">
              No Cover
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="mb-2 text-2xl font-bold">{manga.title}</h1>

          {manga.authors && manga.authors.length > 0 && (
            <p className="mb-1 text-sm text-gray-400">
              By {manga.authors.join(", ")}
            </p>
          )}

          {manga.status && (
            <p className="mb-3 text-sm text-gray-500">{manga.status}</p>
          )}

          {manga.genres && manga.genres.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {manga.genres.map((g) => (
                <span
                  key={g}
                  className="rounded bg-surface-200 px-2 py-0.5 text-xs text-gray-400"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {manga.description && (
            <p className="line-clamp-5 max-w-lg text-sm leading-relaxed text-gray-400">
              {manga.description}
            </p>
          )}
        </div>
      </div>

      {/* Chapters */}
      <h2 className="mb-4 text-lg font-semibold">
        Chapters ({chapters.length}){" "}
        {chapters.length === 0 && (
          <span className="text-sm font-normal text-gray-500">
            &mdash; no chapters found for this manga
          </span>
        )}
      </h2>
      <ChapterList
        chapters={chapters}
        sourceId={sourceId}
        mangaId={mangaId}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </div>
  );
}
