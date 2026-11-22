# 8 · Checkpoint Review - kết quả chuẩn sau bài 5.2, 5.3

> Mở sau khi đã tự review Checkpoint Code - nhánh này chứa luôn đáp án.

**Nhánh:** `lab5/checkpoint-review` = `lab5/checkpoint-code` + 2 commit:

| Commit                                                          | Nội dung                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `fix(orders): address code review findings for story 1.1`       | sửa các finding `patch` của story 1.1, mỗi bản sửa kèm test; spec 1.1 có `### Review Findings` |
| `fix(orders): address code review findings for story 1.2`       | tương tự cho story 1.2                                                                    |

- Spec 1.1, 1.2: mục `### Review Findings` (patch đã sửa, defer, phụ lục **Rejected** kèm lý do).
- `_bmad-output/implementation-artifacts/deferred-work.md`: lỗi có từ trước được `defer` thay vì sửa lẫn vào story.
- `sprint-status.yaml`: `1-1-...: done`, `1-2-...: done`, `epic-1: in-progress` (còn story 1.3).
- Mỗi test mới **fail trên code của Checkpoint Code, pass sau khi sửa** - kiểm như bài 5.3:
  ```bash
  git stash push -- src/features/orders/order-state-machine.ts   # tạm cất file nguồn đã sửa, giữ test mới
  npx vitest run src/features/orders                             # test mới FAIL
  git stash pop
  ```
- `npm run check` và `npm run test:e2e` pass.

## Dùng nhánh này để

1. **So sánh** với kết quả review của mình:
   ```bash
   git diff lab5/checkpoint-code lab5/checkpoint-review -- src
   git show lab5/checkpoint-review:_bmad-output/implementation-artifacts/spec-1-1-may-trang-thai-don-hang.md
   ```
   Finding nào mình bắt được mà bản chuẩn không có (hoặc ngược lại)? Mình đã `reject` finding nào mà bản chuẩn sửa?
2. **Đi tiếp** story 1.3 hoặc 3.1 (bài 5.1 bước 5) từ một Epic 1 sạch:
   ```bash
   git switch -c lab5-next lab5/checkpoint-review
   ```
   ```text
   /bmad-build story 1.3 trong _bmad-output/planning-artifacts/epics.md
   (sprint-status: _bmad-output/implementation-artifacts/sprint-status.yaml).
   Tài liệu nguồn: PRD _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md,
   spine _bmad-output/planning-artifacts/architecture/architecture-shoplite-ops-2026-11-20/ARCHITECTURE-SPINE.md.
   ```
   `bmad-build` sẽ nạp spec 1.2 (`done`) để nối tiếp Code Map.
