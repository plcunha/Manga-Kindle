"use client";

import { useState, useEffect } from "react";
import { getSources, searchManga, type Source, type MangaInfo } from "@/lib/api";
import { MangaCard } from "@/components/manga-card";

/** Human-friendly language names for ISO 639-1 codes */
const LANG_LABELS: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  pt: "Portuguese",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  tr: "Turkish",
  pl: "Polish",
  nl: "Dutch",
  multi: "Multi-language",
};

export default function SearchPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [langFilter, setLangFilter] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MangaInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load sources (re-fetch when language filter changes)
  useEffect(() => {
    getSources(langFilter || undefined)
      .then(({ sources: s, languages: langs }) => {
        setSources(s);
        setLanguages(langs);
        // Keep current selection if still in list, otherwise pick first
        if (s.length > 0) {
          const stillExists = s.find((src) => src.id === sourceId);
          if (!stillExists) setSourceId(s[0].id);
        } else {
          setSourceId("");
        }
      })
      .catch(() => setError("Failed to load sources. Is the API running?"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langFilter]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId || !query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const data = await searchManga(sourceId, query.trim());
      setResults(data);
      if (data.length === 0) setError("No results found.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Search Manga</h1>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8 flex flex-wrap gap-3">
        {/* Language filter */}
        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
        >
          <option value="">All languages ({languages.length})</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {LANG_LABELS[lang] || lang}
            </option>
          ))}
        </select>

        {/* Source selector */}
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {sources.length === 0 && (
            <option value="" disabled>
              No sources
            </option>
          )}
        </select>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title..."
          className="flex-1 rounded-lg border border-surface-200 bg-surface-100 px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-accent focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="mb-4 rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Results Grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((manga) => (
            <MangaCard key={manga.id} manga={manga} sourceId={sourceId} />
          ))}
        </div>
      )}
    </div>
  );
}
