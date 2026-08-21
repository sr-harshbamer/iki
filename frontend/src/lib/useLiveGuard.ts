"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttackForecast, DecisionRisk, RiskLevel, Signal } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export interface LiveMessage {
  id: number;
  text: string;
}

export interface LiveGuardState {
  connected: boolean;
  messages: LiveMessage[];
  score: number;
  level: RiskLevel | null;
  category: string | null;
  signals: Signal[];
  decisionRisk: DecisionRisk | null;
  attackForecast: AttackForecast | null;
  escalated: boolean;
  escalationMessage: string | null;
  semanticPending: boolean;
}

const INITIAL_STATE: LiveGuardState = {
  connected: false,
  messages: [],
  score: 0,
  level: null,
  category: null,
  signals: [],
  decisionRisk: null,
  attackForecast: null,
  escalated: false,
  escalationMessage: null,
  semanticPending: false,
};

/**
 * Drives the live conversation monitor over a persistent WebSocket -- the
 * genuinely "as it happens" counterpart to the request/response analyze
 * flow everywhere else in the app. Each `sendMessage` call simulates one
 * new message "arriving"; the server reacts to it on its own and this hook
 * mirrors whatever it decides (score updates, escalation) without the
 * caller ever "checking" anything.
 */
export function useLiveGuard(senderId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);
  const [state, setState] = useState<LiveGuardState>(INITIAL_STATE);

  const connect = useCallback(() => {
    const url = `${WS_BASE}/ws/live${senderId ? `?sender_id=${encodeURIComponent(senderId)}` : ""}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setState((s) => ({ ...s, connected: true }));
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "update") {
        setState((s) => ({
          ...s,
          score: data.score,
          level: data.level,
          category: data.category,
          signals: data.signals,
          decisionRisk: data.decision_risk,
          semanticPending: true,
        }));
      } else if (data.type === "semantic_update") {
        setState((s) => ({
          ...s,
          score: data.score,
          level: data.level,
          signals: data.signals,
          decisionRisk: data.decision_risk,
          attackForecast: data.attack_forecast,
          semanticPending: false,
        }));
      } else if (data.type === "escalation") {
        setState((s) => ({ ...s, escalated: true, escalationMessage: data.message }));
      }
    };
  }, [senderId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;
    idRef.current += 1;
    setState((s) => ({ ...s, messages: [...s.messages, { id: idRef.current, text: trimmed }] }));
    wsRef.current.send(JSON.stringify({ text: trimmed }));
  }, []);

  const reset = useCallback(() => {
    wsRef.current?.close();
    idRef.current = 0;
    setState(INITIAL_STATE);
    connect();
  }, [connect]);

  return { ...state, sendMessage, reset };
}
