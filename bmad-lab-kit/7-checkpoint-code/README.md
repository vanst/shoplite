# 7 · Checkpoint Code - đầu vào cho bài Review (5.2, 5.3)

**Nhánh:** `lab5/checkpoint-code`

Trạng thái repo giống hệt sau khi một học viên dùng material 1-6 rồi chạy `/bmad-build` cho **story 1.1** và **story 1.2** (mỗi story một phiên):

| Commit (từ cũ tới mới)                                              | Nội dung                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs(bmad): planning artifacts và sprint 1 (bộ chuẩn bước 1-6)`     | `_bmad-output/` = material 1-6 (`node bmad-lab-kit/use.mjs 6`)                                   |
| `feat(orders): máy trạng thái đơn hàng (story 1.1)`                  | `order-state-machine.ts` + test, `cancelOrder` dùng máy trạng thái; spec 1.1 `done`              |
| `feat(orders): lịch sử trạng thái đơn (story 1.2)`                   | `statusHistory`, `order-history.ts` + test, đơn cũ suy ra lịch sử; spec 1.2 `done`               |

- `spec-1-1-...md`, `spec-1-2-...md`: `status: done`, có `baseline_commit`, Tasks `[x]`, `## Review Triage Log` của review nội bộ `bmad-build`.
- `sprint-status.yaml`: `epic-1: in-progress`, `1-1-...: review`, `1-2-...: review`.
- `npm run check` pass.

Code này do AI viết và đã qua review nội bộ của `bmad-build` (3 lớp, **cùng model** với model viết code). Pass test không có nghĩa là đúng yêu cầu: nhiệm vụ của bài 5.2 là tìm phần còn sót bằng `bmad-code-review` chạy trên **model khác**.

## Bắt đầu

```bash
git fetch origin
git switch -c lab5-review origin/lab5/checkpoint-code   # đã có nhánh local thì: git switch -c lab5-review lab5/checkpoint-code
git status                                               # phải sạch
npm run check
```

Lấy thông tin diff của từng story:

```bash
grep baseline_commit _bmad-output/implementation-artifacts/spec-1-*.md
git log --oneline -3
```

- Story 1.1: `<baseline_commit của spec-1-1>..<commit "feat(orders): máy trạng thái...">`
- Story 1.2: `<baseline_commit của spec-1-2>..<commit "feat(orders): lịch sử trạng thái...">`

## Review story 1.1 (bài 5.2)

Phiên mới, **model khác** model build (`claude --model sonnet` hoặc lớp review Gemini/Codex như guide 5.2), gọi không tham số:

```text
/bmad-code-review
```

Skill liệt kê hai story đang `review`. Trả lời trong **một** tin nhắn:

```text
Review this story (1.1), commit range <baseline spec-1-1>..<commit story 1.1>,
spec _bmad-output/implementation-artifacts/spec-1-1-may-trang-thai-don-hang.md
```

Sau đó làm tiếp bài 5.3 (quyết định, xem từng patch, test tái hiện, commit). Lặp lại cho story 1.2 với `spec-1-2-lich-su-trang-thai-don.md`.

Gợi ý khi đọc finding: đối chiếu với mục **Boundaries & Constraints** và **I/O & Edge-Case Matrix** trong spec (phần frozen), và với các AD của spine. Một finding thật phải tái hiện được bằng một test.

Làm xong, so với [8-checkpoint-review](../8-checkpoint-review/README.md).
