"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface ProgressEvent {
  type: "download" | "conversion";
  jobId: string;
  status: string;
  progress: number;
  message?: string;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<(event: ProgressEvent) => void>>(new Set());

  const subscribe = useCallback((fn: (event: ProgressEvent) => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      `ws://${window.location.hostname}:3001/ws`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (msg) => {
        try {
          const event: ProgressEvent = JSON.parse(msg.data);
          setLastEvent(event);
          listenersRef.current.forEach((fn) => fn(event));
        } catch {
          // ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return { connected, lastEvent, subscribe };
}
