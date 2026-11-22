# BMAD Lab Kit - bộ material chuẩn cho Module 4, 5

Mỗi bước thực hành BMAD sinh ra tài liệu làm đầu vào cho bước sau. Phiên của học viên thường lệch (brainstorm lan man, bỏ qua bước, PRD thiếu FR...), nên bước sau dễ bị "kéo lệch" theo. Kit này cung cấp **đầu vào chuẩn cho từng bước**: học viên thực hành bước nào cũng được, sai cũng được, nhưng bước kế tiếp luôn bắt đầu từ cùng một bộ tài liệu.

- **Tính năng duy nhất:** _ShopLite Ops - nhân viên vận hành đơn hàng_ (Ý tưởng A trong `lab-guides/module-4-bmad-planning/reference/feature-ideas.md`). Không làm ý tưởng B, C.
- **Bám code thật:** mọi tham chiếu file, hàm, quy tắc nghiệp vụ trong tài liệu đã được kiểm với code ShopLite hiện tại; spine qua `lint_spine.py`; `sprint-status.yaml` sinh bằng `sprint_plan.py` của BMAD 6.12.4 (Sprint 1 đặt `ready-for-dev` bằng `--set`, như bài 4.7).
- **Định dạng đúng BMAD 6.12.4:** cùng tên file, thư mục, frontmatter, mục tiêu đề như skill sinh ra, nên skill bước sau đọc được ngay.

## Bản đồ: bước thực hành → material

```text
BMAD Method  ──Brainstorm──▶[1 Brainstorm Intent]──Brief──▶[2 PRD]──Design──▶[3 Design MD]──Architect──▶[4 Architecture MD]──Epics──▶[5 Epic MD]
BMAD Build   [5 Epic MD]──Plan──▶[6 Story MD]──Code──▶[7 Checkpoint Code]──Review──▶[8 Checkpoint Review]
```

| Material (cục đỏ)        | Là output chuẩn của bước     | Dùng làm đầu vào cho bước (bài)                         | Cách lấy                                   |
| ------------------------ | ---------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| **1 Brainstorm Intent**  | Brainstorm (4.2)             | Phản biện (4.3, tùy chọn), Brief + PRD (4.4)            | `node bmad-lab-kit/use.mjs 1`              |
| **2 PRD**                | Brief + PRD (4.4)            | Design (4.5)                                            | `node bmad-lab-kit/use.mjs 2`              |
| **3 Design MD**          | Design (4.5)                 | Architecture (4.6)                                      | `node bmad-lab-kit/use.mjs 3`              |
| **4 Architecture MD**    | Architecture (4.6)           | Epics + sprint (4.7)                                    | `node bmad-lab-kit/use.mjs 4`              |
| **5 Epic MD**            | Epics + sprint (4.7)         | Plan - `bmad-build` tới Checkpoint 1 (5.1)              | `node bmad-lab-kit/use.mjs 5`              |
| **6 Story MD**           | Plan (5.1, Checkpoint 1)     | Code - `bmad-build` implement (5.1)                     | `node bmad-lab-kit/use.mjs 6`              |
| **7 Checkpoint Code**    | Code (5.1)                   | Review - `bmad-code-review` + sửa (5.2, 5.3)            | nhánh `lab5/checkpoint-code` - xem [7-checkpoint-code](7-checkpoint-code/README.md) |
| **8 Checkpoint Review**  | Review + fix (5.2, 5.3)      | So sánh kết quả; điểm xuất phát cho story 1.3, 3.1      | nhánh `lab5/checkpoint-review` - xem [8-checkpoint-review](8-checkpoint-review/README.md) |

`use.mjs N` chép material của bước N **và mọi bước trước** (bỏ qua bước nào cũng có đủ tài liệu). Bản brief không có trong kit: PRD chuẩn được dựng từ brainstorm intent, output brief của học viên được bỏ qua.

## Nội dung từng material

| #   | File (đường dẫn sau khi chép vào `_bmad-output/`)                                                                                   | Điểm chính                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `brainstorming/brainstorm-shoplite-ops-2026-11-20/brainstorm-intent.md`, `phan-bien.md`                                              | 5 Must (MoSCoW), quyết định đã chốt, 8 rủi ro phát hiện từ code (không trừ kho, `.tmp` dùng chung, fail-open...) |
| 2   | `planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md`, `addendum.md`                                                          | `status: final`, FR-1..FR-14 có Consequences kiểm thử được, UJ-1..UJ-3, SM-1..SM-4 + SM-C1, hành vi phải giữ   |
| 3   | `planning-artifacts/ux-designs/ux-shoplite-ops-2026-11-20/DESIGN.md`, `EXPERIENCE.md`, `mockups/admin-order-detail.html`             | Token hex đúng Tailwind v4 (`indigo-600` = `#4F39F6`), delta cho trang vận hành, state patterns, `data-testid`  |
| 4   | `planning-artifacts/architecture/architecture-shoplite-ops-2026-11-20/ARCHITECTURE-SPINE.md`                                         | AD-1..AD-3 `[ADOPTED]`, AD-4..AD-10 mới (máy trạng thái, lịch sử, tồn kho, hàng đợi ghi, fail-closed, cookie HMAC) |
| 5   | `planning-artifacts/epics.md`, `implementation-artifacts/sprint-status.yaml`                                                         | 4 epic, 9 story, đủ AC Given/When/Then; Sprint 1 = story 1.1, 1.2, 1.3, 3.1 ở `ready-for-dev`                   |
| 6   | `implementation-artifacts/epic-1-context.md`, `spec-1-1-may-trang-thai-don-hang.md`                                                  | Spec story 1.1 `ready-for-dev` (đã qua Checkpoint 1): frozen Intent/Boundaries/Matrix, Code Map, Tasks          |

## Cách dùng trong lớp

1. Học viên làm bước thực hành như guide, với output của chính mình. Xong bước (hoặc hết giờ), **commit output của mình** để giữ lại:
   `git add _bmad-output && git commit -m "docs(bmad): <bước> - bản của tôi"`
2. Lấy material chuẩn cho bước kế tiếp rồi commit (bmad-build dừng nếu cây git bẩn):
   ```bash
   node bmad-lab-kit/use.mjs 2
   git add _bmad-output && git commit -m "chore(bmad): dùng material chuẩn bước 2 (PRD)"
   ```
3. Chạy bước kế tiếp bằng prompt bên dưới. Prompt luôn chỉ **đường dẫn tường minh** tới material chuẩn, để skill không nhặt nhầm tài liệu của học viên (thư mục khác tên/ngày).

> ⚠️ Riêng trước bước 6 (Code): nếu `_bmad-output/implementation-artifacts/` đang có spec của học viên ở trạng thái `draft` / `ready-for-dev` / `in-progress`, hãy xóa hoặc chuyển chúng đi - `bmad-build` sẽ liệt kê mọi spec đang dở và hỏi lại.

## Prompt mẫu cho từng bước (dùng material chuẩn)

Mỗi prompt chạy trong **phiên Claude Code mới**.

**Bài 4.3 - Phản biện** (material 1, tùy chọn)

```text
/bmad-party-mode --mode subagent
Hãy cùng phản biện ý tưởng trong _bmad-output/brainstorming/brainstorm-shoplite-ops-2026-11-20/brainstorm-intent.md
cho ShopLite (đọc AGENTS.md). John: MVP có quá to không? Winston: ràng buộc lưu file JSON, một tiến trình?
Amelia: phần nào khó test nhất? Mary: giả định nào chưa kiểm chứng? Tranh luận thẳng thắn, hỏi tôi khi cần quyết định.
```

**Bài 4.4 - Brief + PRD** (material 1)

```text
/bmad-product-brief Tạo product brief cho ShopLite.
Đầu vào: _bmad-output/brainstorming/brainstorm-shoplite-ops-2026-11-20/brainstorm-intent.md và phan-bien.md cùng thư mục.
Bối cảnh: tính năng mới trên sản phẩm đang chạy (đọc AGENTS.md, README.md). Không dịch vụ ngoài, không database.
```

```text
/bmad-prd Tạo PRD mới.
Đầu vào: brief vừa tạo, _bmad-output/brainstorming/brainstorm-shoplite-ops-2026-11-20/brainstorm-intent.md, phan-bien.md, AGENTS.md.
Brownfield: đọc code để kiểm chứng mọi tham chiếu; tách rõ hành vi MỚI và hành vi HIỆN CÓ phải giữ nguyên.
Giữ ID FR-1, UJ-1, SM-1 và tiêu đề cấu trúc như template; nội dung tiếng Việt.
```

**Bài 4.5 - Design** (material 2)

```text
/bmad-ux Tạo UX cho tính năng trong PRD _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md.
Sản phẩm đang chạy, đã có design system ngầm định - đọc code để ghi nhận, KHÔNG thiết kế lại (Tailwind v4,
Be Vietnam Pro, indigo-600, src/components/ui/button.tsx, order-status-badge.tsx). DESIGN.md chỉ ghi token hiện có
+ delta cho màn hình mới. Giao diện tiếng Việt, mobile 390px.
```

**Bài 4.6 - Architecture** (material 3)

```text
/bmad-architecture Tạo architecture spine cho tính năng trong
_bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md (đọc cả addendum.md cùng thư mục) và UX trong
_bmad-output/planning-artifacts/ux-designs/ux-shoplite-ops-2026-11-20/.
Brownfield: điều tra code thật trước khi quyết định. Phê chuẩn quy ước đã có thành [ADOPTED]. Không thêm database
hay dịch vụ ngoài; vẫn lưu file JSON trong storage/. Phiên bản stack lấy từ package.json.
```

**Bài 4.7 - Epics + sprint** (material 4)

```text
/bmad-create-epics-and-stories
Tài liệu đầu vào:
- PRD: _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md
- Architecture: _bmad-output/planning-artifacts/architecture/architecture-shoplite-ops-2026-11-20/ARCHITECTURE-SPINE.md
- UX: _bmad-output/planning-artifacts/ux-designs/ux-shoplite-ops-2026-11-20/DESIGN.md và EXPERIENCE.md
Tiêu đề giữ đúng tiếng Anh "## Epic N: <tên>" và "### Story N.M: <tên>". Nội dung, AC tiếng Việt, Given/When/Then.
Mỗi story vừa một phiên AI (~1-2 giờ), có AC cho trường hợp lỗi/biên, ghi AD-n liên quan.
```

**Bài 5.1 - Plan** (material 5): dừng ở Checkpoint 1 bằng **Approve and stop**, so sánh spec của mình với material 6.

```text
/bmad-build story 1.1 trong _bmad-output/planning-artifacts/epics.md
(sprint-status: _bmad-output/implementation-artifacts/sprint-status.yaml).
Tài liệu nguồn: PRD _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md,
spine _bmad-output/planning-artifacts/architecture/architecture-shoplite-ops-2026-11-20/ARCHITECTURE-SPINE.md,
UX _bmad-output/planning-artifacts/ux-designs/ux-shoplite-ops-2026-11-20/.
```

**Bài 5.1 - Code** (material 6): truyền thẳng đường dẫn spec, `bmad-build` đi thẳng vào implement (bỏ qua Plan).

```text
/bmad-build _bmad-output/implementation-artifacts/spec-1-1-may-trang-thai-don-hang.md
```

**Bài 5.2, 5.3 - Review** (material 7): xem [7-checkpoint-code/README.md](7-checkpoint-code/README.md).

## Dành cho giảng viên

- Đáp án Checkpoint Code (các lỗi còn sót mà bài Review cần tìm, lớp nào hay bắt, cách sửa, test chứng minh) nằm ngoài repo, trong
  `lab-guides/module-5-bmad-build-review/reference/dap-an-checkpoint-code.md` - **không** phát cho học viên trước bài 5.2.
- Đẩy kit và hai nhánh checkpoint lên repo lớp: `git push origin bmad/source lab5/checkpoint-code lab5/checkpoint-review`.
- Đổi nội dung một material thì đổi cả bản đã chép trong hai nhánh checkpoint (thư mục `_bmad-output/`), để hai nơi không lệch nhau.
