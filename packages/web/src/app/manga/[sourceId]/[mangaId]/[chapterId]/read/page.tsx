"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getChapterPages,
  getMangaDetail,
  type ChapterInfo,
  type PageInfo,
} from "@/lib/api";
import { MangaReader } from "@/components/manga-reader";

export default function ReaderPage() {
  const params = useParams<{
    sourceId: string;
    mangaId: string;
    chapterId: string;
  }>();
  const router = useRouter();

  const sourceId = decodeURIComponent(params.sourceId);
  const mangaId = decodeURIComponent(params.mangaId);
  const chapterId = decodeURIComponent(params.chapterId);

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [mangaTitle, setMangaTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch pages + manga detail (for chapter list) in parallel
  useEffect(() => {
    setLoading(true);
    setError("");

    // Pages are essential; manga detail is optional (used for chapter nav & title).
    // If getMangaDetail fails, the reader still works — just without chapter navigation.
    Promise.all([
      getChapterPages(sourceId, mangaId, chapterId),
      getMangaDetail(sourceId, mangaId).catch(() => null),
    ])
      .then(([pageList, detail]) => {
        setPages(pageList);
        if (detail) {
          setChapters(detail.chapters);
          setMangaTitle(detail.manga.title);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load chapter"),
      )
      .finally(() => setLoading(false));
  }, [sourceId, mangaId, chapterId]);

  // Find current chapter and determine prev/next
  const currentChapter = useMemo(
    () => chapters.find((c) => c.id === chapterId),
    [chapters, chapterId],
  );

  const currentIndex = useMemo(
    () => chapters.findIndex((c) => c.id === chapterId),
    [chapters, chapterId],
  );

  // Chapters are typically ordered newest-first, so "next" is index - 1
  // and "previous" is index + 1. We navigate in reading order.
  const prevChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;
  const nextChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;

  function navigateToChapter(ch: ChapterInfo) {
    router.push(
      `/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}/${encodeURIComponent(ch.id)}/read`,
    );
  }

  function handleClose() {
    router.push(
      `/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}`,
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-gray-400">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-accent" />
        <p className="text-sm">Loading chapter...</p>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-4">
        <p className="mb-4 rounded-lg border border-red-800/40 bg-red-900/20 px-6 py-4 text-sm text-red-400">
          {error}
        </p>
        <button
          onClick={handleClose}
          className="rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Back to manga
        </button>
      </div>
    );
  }

  // --- No pages ---
  if (pages.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-4">
        <p className="mb-4 text-sm text-gray-400">
          No pages found for this chapter.
        </p>
        <button
          onClick={handleClose}
          className="rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Back to manga
        </button>
      </div>
    );
  }

  // --- Reader ---
  const chapterLabel = currentChapter
    ? `Ch. ${currentChapter.chapter ?? "?"}${currentChapter.title ? ` - ${currentChapter.title}` : ""}`
    : `Chapter`;

  return (
    <MangaReader
      pages={pages}
      chapterTitle={chapterLabel}
      mangaTitle={mangaTitle}
      onClose={handleClose}
      onPrevChapter={
        prevChapter ? () => navigateToChapter(prevChapter) : undefined
      }
      onNextChapter={
        nextChapter ? () => navigateToChapter(nextChapter) : undefined
      }
    />
  );
}
