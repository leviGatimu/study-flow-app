import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(dirname(fileURLToPath(import.meta.url))), "public", "audio");
function frames(p) {
  const b = readFileSync(p);
  let off = 12, sr = 0, ch = 1, bps = 16, data = 0;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const sz = b.readUInt32LE(off + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(off + 10); sr = b.readUInt32LE(off + 12); bps = b.readUInt16LE(off + 22); }
    if (id === "data") { data = sz; break; }
    off += 8 + sz + (sz & 1);
  }
  return Math.ceil((data / (sr * ch * (bps / 8))) * 30);
}
const ids = ["vo1","vo2","vo3","vo4","vo5","vo6","vo7","vo8","vo9"];
const out = {};
for (const f of ids) out[f] = frames(join(dir, f + ".wav"));
console.log(JSON.stringify(out));
