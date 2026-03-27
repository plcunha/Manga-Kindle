"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getConversions,
  getDownloads,
  getDeviceProfiles,
  startConversion,
  cancelConversion,
  downloadConvertedFile,
  type ConversionJob,
  type DownloadJob,
  type DeviceProfile,
} from "@/lib/api";
import { useWebSocket, type ProgressEvent } from "@/lib/websocket";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";

const FORMATS = ["EPUB", "MOBI", "AZW3", "CBZ", "PDF"];

export default function ConversionsPage() {
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribe } = useWebSocket();

  // New conversion form
  const [selectedDownload, setSelectedDownload] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("EPUB");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [converting, setConverting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [c, d, p] = await Promise.all([
        getConversions(),
        getDownloads(),
        getDeviceProfiles(),
      ]);
      setJobs(c);
      setDownloads(d.filter((dl) => dl.status === "completed"));
      setProfiles(p);
      if (p.length > 0 && !selectedProfile) setSelectedProfile(p[0].id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time updates
  useEffect(() => {
    return subscribe((event: ProgressEvent) => {
      if (event.type !== "conversion") return;
      setJobs((prev) =>
        prev.map((j) =>
          j.id === event.jobId
            ? { ...j, status: event.status, progress: event.progress }
            : j,
        ),
      );
    });
  }, [subscribe]);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDownload) return;
    setConverting(true);
    try {
      const job = await startConversion({
        downloadJobId: selectedDownload,
        format: selectedFormat,
        deviceProfile: selectedProfile,
        mangaMode: true,
      });
      setJobs((prev) => [job, ...prev]);
      setShowForm(false);
    } catch {
      // ignore
    } finally {
      setConverting(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelConversion(id);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id ? { ...j, status: "cancelled" } : j,
        ),
      );
    } catch {
      // ignore
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
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conversions</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {showForm ? "Cancel" : "New Conversion"}
        </button>
      </div>

      {/* New Conversion Form */}
      {showForm && (
        <form
          onSubmit={handleConvert}
          className="mb-6 rounded-lg border border-surface-200 bg-surface-50 p-4"
        >
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Download
              </label>
              <select
                value={selectedDownload}
                onChange={(e) => setSelectedDownload(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                <option value="">Select download...</option>
                {downloads.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.manga?.title ?? d.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Format
              </label>
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-400">
                Device
              </label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-surface-100 px-3 py-2 text-sm text-gray-200 focus:border-accent focus:outline-none"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedDownload || converting}
            className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {converting ? "Starting..." : "Start Conversion"}
          </button>
        </form>
      )}

      {/* Conversion Jobs */}
      {jobs.length === 0 ? (
        <p className="py-12 text-center text-gray-500">
          No conversions yet. Download manga first, then convert for your
          Kindle.
        </p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-surface-200 bg-surface-50 p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">
                    {job.downloadJob?.manga?.title ?? job.downloadJobId}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {job.format} &middot; {job.deviceProfile}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  {(job.status === "queued" ||
                    job.status === "processing") && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/20"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <ProgressBar progress={job.progress} />

              {job.error && (
                <p className="mt-2 text-xs text-red-400">{job.error}</p>
              )}

              {job.outputPath && job.status === "completed" && (
                <button
                  onClick={() => downloadConvertedFile(job.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 5v14m0 0-6-6m6 6 6-6"
                    />
                    <path strokeLinecap="round" d="M5 19h14" />
                  </svg>
                  Download {job.format}
                </button>
              )}

              <p className="mt-2 text-[11px] text-gray-600">
                {new Date(job.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
