"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ApiErrorBody } from "@/lib/http";
import { useHydrated } from "@/lib/use-hydrated";

const FIELD_ERROR_ID = "login-password-error";
const BANNER_ID = "login-error";
const WRONG_PASSWORD_MESSAGE = "Mật khẩu không đúng";
const EMPTY_MESSAGE = "Vui lòng nhập mật khẩu";
const EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại";
const SERVER_ERROR_MESSAGE = "Đã có lỗi xảy ra, vui lòng thử lại sau";
const NETWORK_ERROR_MESSAGE = "Không kết nối được máy chủ, vui lòng thử lại.";

const inputClass =
  "h-11 w-full rounded-xl border-0 bg-white px-3 text-sm ring-1 ring-inset placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

interface LoginFormProps {
  /** Đường dẫn đã qua sanitizeNext ở server. */
  next: string;
  expired?: boolean;
}

export function LoginForm({ next, expired = false }: LoginFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; focusInput: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);

  // Phiên hết hạn: đưa con trỏ vào ô để nhập lại ngay
  useEffect(() => {
    if (expired) inputRef.current?.focus();
  }, [expired]);

  // Sai mật khẩu: focus ô; 429/500/mạng: banner nhận focus
  useEffect(() => {
    if (banner) (banner.focusInput ? inputRef.current : bannerRef.current)?.focus();
  }, [banner]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setBanner(null);

    if (password === "") {
      setFieldError(EMPTY_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push(next);
        router.refresh(); // layout dùng chung phải đọc lại phiên để hiện nút Đăng xuất
        return;
      }
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      if (response.status === 401) {
        setPassword("");
        setBanner({ message: body?.error?.message ?? WRONG_PASSWORD_MESSAGE, focusInput: true });
      } else {
        const message =
          (response.status === 429 ? body?.error?.message : undefined) ?? SERVER_ERROR_MESSAGE;
        setBanner({ message, focusInput: false });
      }
    } catch {
      setBanner({ message: NETWORK_ERROR_MESSAGE, focusInput: false });
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {expired && <p className="text-sm text-slate-700">{EXPIRED_MESSAGE}</p>}
      {/* Input ẩn để trình quản lý mật khẩu gắn tên đăng nhập */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        defaultValue="admin"
        hidden
        readOnly
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Mật khẩu
        </label>
        <input
          ref={inputRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldError !== null || banner?.focusInput === true}
          aria-describedby={
            fieldError ? FIELD_ERROR_ID : banner?.focusInput ? BANNER_ID : undefined
          }
          className={cn(
            inputClass,
            fieldError || banner?.focusInput ? "ring-rose-400" : "ring-slate-300",
          )}
        />
        {fieldError && (
          <p id={FIELD_ERROR_ID} className="text-xs text-rose-600">
            {fieldError}
          </p>
        )}
      </div>
      {banner && (
        <p
          id={BANNER_ID}
          ref={bannerRef}
          tabIndex={-1}
          data-testid="login-error"
          className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {banner.message}
        </p>
      )}
      {/* Khóa nút tới khi hydrate xong: submit native sẽ đưa mật khẩu lên URL bằng GET */}
      <Button type="submit" size="lg" className="w-full" disabled={submitting || !hydrated}>
        {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
