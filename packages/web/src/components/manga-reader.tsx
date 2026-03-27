"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageInfo } from "@/lib/api";

type ReadingMode = "single" | "webtoon";

interface MangaReaderProps {
  pages: PageInfo[];
  chapterTitle: string;
  mangaTitle: string;
  /** Called when user wants to go to previous chapter (undefined = no prev) */
  onPrevChapter?: () => void;
  /** Called when user wants to go to next chapter (undefined = no next) */
  onNextChapter?: () => void;
  onClose: () => void;
}

export function MangaReader({
  pages,
  chapterTitle,
  mangaTitle,
  onPrevChapter,
  onNextChapter,
  onClose,
}: MangaReaderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<ReadingMode>("single");
  const [showUI, setShowUI] = useState(true);
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  const totalPages = pages.length;

  // --- Preload nearby images ---
  useEffect(() => {
    const toPreload = [
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ].filter((i) => i >= 0 && i < totalPages);

    for (const idx of toPreload) {
      if (!loadedPages.has(idx)) {
        const img = new Image();
        img.src = pages[idx].url;
        img.onload = () =>
          setLoadedPages((prev) => new Set(prev).add(idx));
      }
    }
  }, [currentPage, totalPages, pages, loadedPages]);

  // --- Navigation ---
  const goToPage = useCallback(
    (page: number) => {
      if (page < 0) {
        onPrevChapter?.();
        return;
      }
      if (page >= totalPages) {
        onNextChapter?.();
        return;
      }
      setCurrentPage(page);
    },
    [totalPages, onPrevChapter, onNextChapter],
  );

  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  // --- Keyboard navigation ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
          e.preventDefault();
          prevPage();
          break;
        case "ArrowRight":
        case "d":
        case " ":
          e.preventDefault();
          nextPage();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          setMode((prev) => (prev === "single" ? "webtoon" : "single"));
          break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prevPage, nextPage, onClose]);

  // --- Auto-hide UI ---
  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [resetHideTimer]);

  // --- Fullscreen ---
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  // --- Click zones (left 30% = prev, right 30% = next, center = toggle UI) ---
  function handleImageClick(e: React.MouseEvent) {
    if (mode !== "single") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.3) {
      prevPage();
    } else if (x > 0.7) {
      nextPage();
    } else {
      setShowUI((prev) => !prev);
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onMouseMove={resetHideTimer}
    >
      {/* Top bar */}
      <div
        className={`absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 py-3 transition-opacity duration-300 ${
          showUI ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur-sm hover:bg-white/20"
          >
            &larr; Back
          </button>
          <div className="overflow-hidden">
            <p className="truncate text-sm font-medium text-white">
              {mangaTitle}
            </p>
            <p className="truncate text-xs text-gray-400">{chapterTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <button
            onClick={() =>
              setMode((prev) => (prev === "single" ? "webtoon" : "single"))
            }
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-white/20"
            title="Toggle reading mode (M)"
          >
            {mode === "single" ? "Page" : "Scroll"}
          </button>
          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-white/20"
            title="Toggle fullscreen (F)"
          >
            Fullscreen
          </button>
        </div>
      </div>

      {/* Reading area */}
      {mode === "single" ? (
        <SinglePageView
          pages={pages}
          currentPage={currentPage}
          onImageClick={handleImageClick}
        />
      ) : (
        <WebtoonView
          pages={pages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Bottom bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 transition-opacity duration-300 ${
          showUI ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Prev chapter */}
          <button
            onClick={onPrevChapter}
            disabled={!onPrevChapter}
            className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs text-white disabled:opacity-30"
            title="Previous chapter"
          >
            &laquo; Prev Ch.
          </button>

          {/* Page navigation */}
          {mode === "single" && (
            <>
              <button
                onClick={prevPage}
                disabled={currentPage === 0 && !onPrevChapter}
                className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                &larr;
              </button>

              {/* Page slider */}
              <input
                type="range"
                min={0}
                max={totalPages - 1}
                value={currentPage}
                onChange={(e) => setCurrentPage(Number(e.target.value))}
                className="flex-1 accent-accent"
              />

              <span className="shrink-0 text-xs text-white tabular-nums">
                {currentPage + 1} / {totalPages}
              </span>

              <button
                onClick={nextPage}
                disabled={
                  currentPage === totalPages - 1 && !onNextChapter
                }
                className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs text-white disabled:opacity-30"
              >
                &rarr;
              </button>
            </>
          )}

          {mode === "webtoon" && (
            <span className="flex-1 text-center text-xs text-white tabular-nums">
              {currentPage + 1} / {totalPages}
            </span>
          )}

          {/* Next chapter */}
          <button
            onClick={onNextChapter}
            disabled={!onNextChapter}
            className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs text-white disabled:opacity-30"
            title="Next chapter"
          >
            Next Ch. &raquo;
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Single Page View
// ────────────────────────────────────────────

function SinglePageView({
  pages,
  currentPage,
  onImageClick,
}: {
  pages: PageInfo[];
  currentPage: number;
  onImageClick: (e: React.MouseEvent) => void;
}) {
  const page = pages[currentPage];
  if (!page) return null;

  return (
    <div
      className="flex flex-1 cursor-pointer items-center justify-center overflow-hidden"
      onClick={onImageClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={page.url}
        src={page.url}
        alt={`Page ${currentPage + 1}`}
        className="max-h-full max-w-full object-contain"
        draggable={false}
      />
    </div>
  );
}

// ────────────────────────────────────────────
// Webtoon (Vertical Scroll) View
// ────────────────────────────────────────────

function WebtoonView({
  pages,
  onPageChange,
}: {
  pages: PageInfo[];
  onPageChange: (page: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the most visible page
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio)
          ) {
            bestEntry = entry;
          }
        }
        if (bestEntry) {
          const idx = Number(
            (bestEntry.target as HTMLElement).dataset.pageIndex,
          );
          if (!isNaN(idx)) onPageChange(idx);
        }
      },
      { root: scrollRef.current, threshold: [0.25, 0.5, 0.75] },
    );

    const refs = imageRefs.current;
    for (const ref of refs) {
      if (ref) observerRef.current.observe(ref);
    }

    return () => observerRef.current?.disconnect();
  }, [pages, onPageChange]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl">
        {pages.map((page, idx) => (
          <div
            key={page.url}
            ref={(el) => { imageRefs.current[idx] = el; }}
            data-page-index={idx}
            className="flex justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.url}
              alt={`Page ${idx + 1}`}
              className="w-full"
              loading={idx < 5 ? "eager" : "lazy"}
            />
          </div>
        ))}

        {/* End of chapter prompt */}
        <div className="flex items-center justify-center gap-4 py-12">
          <span className="text-sm text-gray-500">End of chapter</span>
        </div>
      </div>
    </div>
  );
}
