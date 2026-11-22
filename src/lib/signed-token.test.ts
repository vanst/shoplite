// @vitest-environment node
import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./signed-token";

const key = "khoa-thu-nghiem";
const purpose = "thu";
const now = () => 1_000;
const sign = (payload = { sub: "a" }) => signToken(payload, { key, purpose, now, ttlMs: 500 });

describe("signed-token", () => {
  it("trả payload kèm exp khi token đúng", () => {
    expect(verifyToken(sign(), { key, purpose, now })).toEqual({ sub: "a", exp: 1_500 });
  });

  it("từ chối khi sửa payload", () => {
    const [, signature] = sign().split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "b", exp: 1_500 })).toString("base64url");
    expect(verifyToken(`${forged}.${signature}`, { key, purpose, now })).toBeNull();
  });

  it("từ chối khi sai khóa hoặc chữ ký sai độ dài", () => {
    expect(verifyToken(sign(), { key: "khac", purpose, now })).toBeNull();
    const [body] = sign().split(".");
    expect(verifyToken(`${body}.abc`, { key, purpose, now })).toBeNull();
    expect(verifyToken(`${body}.`, { key, purpose, now })).toBeNull();
  });

  it("từ chối khi khác purpose", () => {
    expect(verifyToken(sign(), { key, purpose: "khac", now })).toBeNull();
  });

  it("từ chối khi exp bằng hoặc nhỏ hơn now, nhận khi còn hiệu lực", () => {
    expect(verifyToken(sign(), { key, purpose, now: () => 1_499 })).not.toBeNull();
    expect(verifyToken(sign(), { key, purpose, now: () => 1_500 })).toBeNull();
    expect(verifyToken(sign(), { key, purpose, now: () => 2_000 })).toBeNull();
  });

  it("không ném với chuỗi rác", () => {
    for (const junk of ["", "abc", "a.b.c", "....", "%%%.%%%"]) {
      expect(verifyToken(junk, { key, purpose, now })).toBeNull();
    }
  });
});
