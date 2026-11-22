// Chép bộ material chuẩn của bước N (và mọi bước trước đó) vào _bmad-output/ ở gốc repo.
// Cách dùng (chạy ở bất kỳ đâu trong repo): node bmad-lab-kit/use.mjs <1-6>
// Mỗi thư mục bước giữ đúng cấu trúc con của _bmad-output/. File cùng tên sẽ bị GHI ĐÈ bằng bản chuẩn.
import { cpSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kitDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(path.dirname(kitDir), "_bmad-output");
const isMaterial = (name) => name !== "README.md";

// Bước có material = thư mục "N-..." chứa thứ gì đó ngoài README.md (bước 7, 8 là nhánh git).
const steps = readdirSync(kitDir)
  .filter((name) => /^\d-/.test(name) && statSync(path.join(kitDir, name)).isDirectory())
  .filter((name) => readdirSync(path.join(kitDir, name)).some(isMaterial))
  .sort();

const target = Number(process.argv[2]);
const chosen = steps.filter((name) => Number.parseInt(name, 10) <= target);

if (!Number.isInteger(target) || chosen.length === 0) {
  console.error(`Cách dùng: node bmad-lab-kit/use.mjs <1-${steps.length}>`);
  for (const step of steps) console.error(`  ${step}`);
  process.exit(1);
}

for (const step of chosen) {
  const stepDir = path.join(kitDir, step);
  for (const name of readdirSync(stepDir).filter(isMaterial)) {
    cpSync(path.join(stepDir, name), path.join(outputDir, name), { recursive: true });
  }
  console.log(`✓ ${step}`);
}
console.log(`Đã chép vào ${outputDir}`);
