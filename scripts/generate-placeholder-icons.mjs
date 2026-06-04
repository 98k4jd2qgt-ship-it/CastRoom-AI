import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const iconDir = path.join(root, "src-tauri", "icons");
const iconPath = path.join(iconDir, "icon.ico");

fs.mkdirSync(iconDir, { recursive: true });

if (!fs.existsSync(iconPath)) {
  fs.writeFileSync(iconPath, createIco());
  console.log(`created ${path.relative(root, iconPath)}`);
} else {
  console.log(`exists ${path.relative(root, iconPath)}`);
}

function createIco() {
  const size = 32;
  const pixelCount = size * size;
  const xorSize = pixelCount * 4;
  const andStride = Math.ceil(size / 32) * 4;
  const andSize = andStride * size;
  const bitmapInfoSize = 40;
  const imageSize = bitmapInfoSize + xorSize + andSize;
  const headerSize = 6 + 16;
  const buffer = Buffer.alloc(headerSize + imageSize);

  let offset = 0;
  buffer.writeUInt16LE(0, offset);
  offset += 2;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(1, offset);
  offset += 2;

  buffer.writeUInt8(size, offset++);
  buffer.writeUInt8(size, offset++);
  buffer.writeUInt8(0, offset++);
  buffer.writeUInt8(0, offset++);
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(32, offset);
  offset += 2;
  buffer.writeUInt32LE(imageSize, offset);
  offset += 4;
  buffer.writeUInt32LE(headerSize, offset);
  offset += 4;

  buffer.writeUInt32LE(bitmapInfoSize, offset);
  offset += 4;
  buffer.writeInt32LE(size, offset);
  offset += 4;
  buffer.writeInt32LE(size * 2, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(32, offset);
  offset += 2;
  buffer.writeUInt32LE(0, offset);
  offset += 4;
  buffer.writeUInt32LE(xorSize + andSize, offset);
  offset += 4;
  buffer.writeInt32LE(2835, offset);
  offset += 4;
  buffer.writeInt32LE(2835, offset);
  offset += 4;
  buffer.writeUInt32LE(0, offset);
  offset += 4;
  buffer.writeUInt32LE(0, offset);
  offset += 4;

  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const dx = x - size / 2 + 0.5;
      const dy = y - size / 2 + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const inside = distance < size * 0.42;
      const edge = distance > size * 0.36 && distance < size * 0.42;
      const alpha = inside ? 255 : 0;
      const r = edge ? 238 : 121;
      const g = edge ? 242 : 242;
      const b = edge ? 247 : 192;
      buffer.writeUInt8(b, offset++);
      buffer.writeUInt8(g, offset++);
      buffer.writeUInt8(r, offset++);
      buffer.writeUInt8(alpha, offset++);
    }
  }

  offset += andSize;
  return buffer;
}

