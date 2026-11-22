"use client";

import { useSyncExternalStore } from "react";
import type { QueueRow } from "./queue-rules";

/**
 * Kết quả tìm theo SĐT, chỉ giữ trong bộ nhớ trang (không URL, không storage, không title).
 * `rows: null` = lần tìm lỗi (hiện ErrorBanner, ô tìm vẫn giữ nội dung).
 */
export interface AdminSearchState {
  phone: string;
  rows: QueueRow[] | null;
  error: string | null;
}

export const SERVER_ERROR_MESSAGE = "Đã có lỗi xảy ra, vui lòng thử lại sau";
export const NETWORK_ERROR_MESSAGE = "Không kết nối được máy chủ, vui lòng thử lại.";

let state: AdminSearchState | null = null;
let input: HTMLInputElement | null = null;
const listeners = new Set<() => void>();

export const adminSearchStore = {
  get: () => state,
  set(next: AdminSearchState) {
    state = next;
    listeners.forEach((l) => l());
  },
  clear() {
    state = null;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useAdminSearch(): AdminSearchState | null {
  return useSyncExternalStore(adminSearchStore.subscribe, adminSearchStore.get, () => null);
}

export function registerSearchInput(el: HTMLInputElement | null) {
  input = el;
}

export function focusSearchInput() {
  input?.focus();
}

export type SearchOutcome =
  { kind: "ok"; rows: QueueRow[] } | { kind: "unauthorized" } | { kind: "error"; message: string };

/** `POST /api/admin/orders/search`: SĐT chỉ nằm trong body. */
export async function searchByPhone(phone: string): Promise<SearchOutcome> {
  try {
    const response = await fetch("/api/admin/orders/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (response.ok) {
      return { kind: "ok", rows: ((await response.json()) as { rows: QueueRow[] }).rows };
    }
    if (response.status === 401) return { kind: "unauthorized" };
    return { kind: "error", message: SERVER_ERROR_MESSAGE };
  } catch {
    return { kind: "error", message: NETWORK_ERROR_MESSAGE };
  }
}

/** Tìm và ghi vào store; trả `unauthorized` để bên gọi chuyển tới đăng nhập. */
export async function runSearch(phone: string): Promise<"ok" | "unauthorized"> {
  const outcome = await searchByPhone(phone);
  if (outcome.kind === "unauthorized") return "unauthorized";
  adminSearchStore.set(
    outcome.kind === "ok"
      ? { phone, rows: outcome.rows, error: null }
      : { phone, rows: null, error: outcome.message },
  );
  return "ok";
}
