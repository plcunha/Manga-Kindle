"use client";

import { useState } from "react";
import type { ChapterInfo } from "@/lib/api";

interface ChapterListProps {
  chapters: ChapterInfo[];
  onDownload: (chapterIds: string[]) => void;
  downloading?: boolean;
}

export function ChapterList({
  chapters,
  onDownload,
  downloading,
}: ChapterListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll() {
    if (selected.size === chapters.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(chapters.map((c) => c.id)));
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
            {selected.size === chapters.length ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-gray-500">
            {selected.size} selected
          </span>
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
        {chapters.map((ch) => (
          <label
            key={ch.id}
            className="flex cursor-pointer items-center gap-3 border-b border-surface-200 px-4 py-2.5 last:border-b-0 hover:bg-surface-100"
          >
            <input
              type="checkbox"
              checked={selected.has(ch.id)}
              onChange={() => toggle(ch.id)}
              className="h-4 w-4 rounded border-gray-600 bg-surface-100 text-accent focus:ring-accent"
            />
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
            <span className="shrink-0 text-xs text-gray-500">
              {ch.pages} pg
            </span>
            {ch.publishedAt && (
              <span className="shrink-0 text-xs text-gray-600">
                {new Date(ch.publishedAt).toLocaleDateString()}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
