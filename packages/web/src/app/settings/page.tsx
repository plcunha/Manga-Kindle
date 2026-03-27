"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSettings,
  updateSettings,
  getDeviceProfiles,
  type DeviceProfile,
} from "@/lib/api";

const FORMATS = ["EPUB", "MOBI", "AZW3", "CBZ", "PDF"];

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [defaultProfile, setDefaultProfile] = useState("KPW5");
  const [defaultFormat, setDefaultFormat] = useState("EPUB");
  const [downloadDir, setDownloadDir] = useState("");
  const [convertedDir, setConvertedDir] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [settings, deviceProfiles] = await Promise.all([
        getSettings(),
        getDeviceProfiles(),
      ]);
      setProfiles(deviceProfiles);

      // Apply saved settings
      if (settings.defaultDeviceProfile)
        setDefaultProfile(settings.defaultDeviceProfile);
      if (settings.defaultFormat) setDefaultFormat(settings.defaultFormat);
      if (settings.downloadDir) setDownloadDir(settings.downloadDir);
      if (settings.convertedDir) setConvertedDir(settings.convertedDir);
    } catch {
      // ignore — settings may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings({
        defaultDeviceProfile: defaultProfile,
        defaultFormat: defaultFormat,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <form onSubmit={handleSave}>
        {/* Conversion Defaults */}
        <section className="mb-6 rounded-lg border border-surface-200 bg-surface-50 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Conversion Defaults
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Default Device Profile
              </label>
              <select
                value={defaultProfile}
                onChange={(e) => setDefaultProfile(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Default Output Format
              </label>
              <select
                value={defaultFormat}
                onChange={(e) => setDefaultFormat(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Directories (read-only info) */}
        <section className="mb-6 rounded-lg border border-surface-200 bg-surface-50 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Directories
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Configured via environment variables. Change in .env or
            docker-compose.yml.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Download Directory
              </label>
              <div className="rounded-lg border border-surface-200 bg-surface-100/50 px-3 py-2 text-sm text-gray-500">
                {downloadDir || process.env.NEXT_PUBLIC_DOWNLOAD_DIR || "./downloads"}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Converted Directory
              </label>
              <div className="rounded-lg border border-surface-200 bg-surface-100/50 px-3 py-2 text-sm text-gray-500">
                {convertedDir || process.env.NEXT_PUBLIC_CONVERTED_DIR || "./converted"}
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="mb-6 rounded-lg border border-surface-200 bg-surface-50 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            About
          </h2>
          <div className="space-y-1 text-sm text-gray-400">
            <p>
              <span className="text-gray-500">Version:</span>{" "}
              <span className="text-gray-300">0.1.0</span>
            </p>
            <p>
              <span className="text-gray-500">Sources:</span>{" "}
              <span className="text-gray-300">
                MangaDex, MangaSee, MangaKakalot
              </span>
            </p>
            <p>
              <span className="text-gray-500">Converter:</span>{" "}
              <span className="text-gray-300">KCC (Kindle Comic Converter)</span>
            </p>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-green-400">Settings saved.</span>
          )}
        </div>
      </form>
    </div>
  );
}
