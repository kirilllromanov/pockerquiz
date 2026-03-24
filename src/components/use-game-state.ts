"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { GameState } from "@/lib/game-types";

type Role = "host" | "player";

export function useGameState(role: Role) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/state?role=${role}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as
        | { ok: true; data: GameState }
        | { ok: false; error: string };

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      setState(payload.data);
      setError("");
    } catch (caught) {
      if ((caught as Error).name === "AbortError") {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Не удалось загрузить игру.");
    }
  }, [role]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 1500);

    return () => {
      window.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [refresh]);

  const hostAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      startTransition(async () => {
        setError("");
        const response = await fetch("/api/host", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, payload }),
        });
        const data = (await response.json()) as
          | { ok: true; data: GameState }
          | { ok: false; error: string };

        if (!data.ok) {
          setError(data.error);
          return;
        }

        setState(data.data);
      });
    },
    [],
  );

  const playerAction = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      setError("");
      const response = await fetch("/api/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, payload }),
      });
      const data = (await response.json()) as
        | { ok: true; data: { playerId?: string; state: GameState } }
        | { ok: false; error: string };

      if (!data.ok) {
        setError(data.error);
        return null;
      }

      setState(data.data.state);
      return data.data;
    },
    [],
  );

  return {
    state,
    error,
    isPending,
    refresh,
    hostAction,
    playerAction,
  };
}
