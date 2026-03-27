"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChapterInfo } from "@/lib/api";

/** Map language codes to flag emoji + short label */
const LANG_FLAGS: Record<string, string> = {
  'pt-br': '🇧🇷 PT',
  pt: '🇵🇹 PT',
  en: '🇬🇧 EN',
  'es-la': '🇲🇽 ES',
  es: '🇪🇸 ES',
  ja: '🇯🇵 JA',
  ko: '🇰🇷 KO',
  zh: '🇨🇳 ZH',
  'zh-hk': '🇭🇰 ZH',
  fr: '🇫🇷 FR',
  de: '🇩🇪 DE',
  it: '🇮🇹 IT',
};

function langLabel(code: string): string {
  return LANG_FLAGS[code] || code.toUpperCase();
}

interface ChapterListProps {
  chapters: ChapterInfo[];
  sourceId: string;
  mangaId: string;
  onDownload: (chapterIds: string[]) => void;
  downloading?: boolean;
}

export function ChapterList({
  chapters,
  sourceId,
  mangaId,
  onDownload,
  downloading,
}: ChapterListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [langFilter, setLangFilter] = useState<string>("all");
  const router = useRouter();

  // Compute available languages from the chapter list
  const availableLanguages = Array.from(
    new Set(chapters.map((c) => c.language)),
  ).sort((a, b) => {
    // Sort: pt-br first, then pt, then en, then rest alphabetically
    const order = ["pt-br", "pt", "en"];
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const filteredChapters =
    langFilter === "all"
      ? chapters
      : chapters.filter((c) => c.language === langFilter);

  function toggleAll() {
    if (selected.size === filteredChapters.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredChapters.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="text-xs text-accent hover:text-accent-hover"
          >
            {selected.size === filteredChapters.length
              ? "Deselect all"
              : "Select all"}
          </button>
          <span className="text-xs text-gray-500">
            {selected.size} selected
          </span>

          {/* Language filter */}
          {availableLanguages.length > 1 && (
            <select
              value={langFilter}
              onChange={(e) => {
                setLangFilter(e.target.value);
                setSelected(new Set());
              }}
              className="rounded border border-surface-200 bg-surface-100 px-2 py-0.5 text-xs text-gray-300"
            >
              <option value="all">
                All languages ({chapters.length})
              </option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {langLabel(lang)} (
                  {chapters.filter((c) => c.language === lang).length})
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          disabled={selected.size === 0 || downloading}
          onClick={() => onDownload(Array.from(selected))}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {downloading ? "Starting..." : "Download Selected"}
        </button>
      </div>

      {/* Chapter rows */}
      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-surface-200">
        {filteredChapters.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            No chapters available
            {langFilter !== "all" ? ` for ${langLabel(langFilter)}` : ""}
          </p>
        )}
        {filteredChapters.map((ch) => (
          <div
            key={ch.id}
            className="flex items-center gap-3 border-b border-surface-200 px-4 py-2.5 last:border-b-0 hover:bg-surface-100"
          >
            <input
              type="checkbox"
              checked={selected.has(ch.id)}
              onChange={() => toggle(ch.id)}
              className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-600 bg-surface-100 text-accent focus:ring-accent"
            />
            <button
              onClick={() =>
                router.push(
                  `/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}/${encodeURIComponent(ch.id)}/read`,
                )
              }
              className="shrink-0 rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/30"
              title="Read online"
            >
              Read
            </button>
            <span className="shrink-0 rounded bg-surface-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              {langLabel(ch.language)}
            </span>
            <div className="flex flex-1 items-baseline gap-2 overflow-hidden">
              <span className="shrink-0 text-sm font-medium text-gray-200">
                Ch. {ch.chapter ?? "?"}
              </span>
              {ch.title && (
                <span className="truncate text-sm text-gray-400">
                  {ch.title}
                </span>
              )}
            </div>
            {ch.publishedAt && (
              <span className="shrink-0 text-xs text-gray-600">
                {new Date(ch.publishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
