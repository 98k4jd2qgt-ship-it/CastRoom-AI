import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const failures = [];

if (!fs.existsSync(tauriConfigPath)) {
  failures.push("Missing src-tauri/tauri.conf.json.");
} else {
  const config = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
  const icons = config.bundle?.icon;
  if (!Array.isArray(icons) || icons.length === 0) {
    failures.push("Tauri bundle.icon must list app icons, including a Windows .ico file.");
  } else {
    const resolvedIcons = icons.map((icon) => ({
      icon,
      fullPath: path.resolve(path.dirname(tauriConfigPath), icon),
    }));
    const icoIcons = resolvedIcons.filter(({ icon }) => path.extname(icon).toLowerCase() === ".ico");
    if (icoIcons.length === 0) {
      failures.push("Tauri bundle.icon must include at least one .ico file for Windows installers.");
    }

    for (const item of resolvedIcons) {
      if (!fs.existsSync(item.fullPath)) {
        failures.push(`Configured Tauri icon does not exist: ${item.icon}`);
        continue;
      }
      const stat = fs.statSync(item.fullPath);
      if (!stat.isFile() || stat.size <= 0) {
        failures.push(`Configured Tauri icon is empty or not a file: ${item.icon}`);
        continue;
      }
      if (path.extname(item.icon).toLowerCase() === ".ico" && !isReadableIco(item.fullPath)) {
        failures.push(`Configured Windows .ico is not readable: ${item.icon}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Desktop package icon validation failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Desktop package icon validation passed");

function isReadableIco(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 22) {
    return false;
  }
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1 || count < 1) {
    return false;
  }
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    if (buffer.length < entryOffset + 16) {
      return false;
    }
    const bytesInResource = buffer.readUInt32LE(entryOffset + 8);
    const imageOffset = buffer.readUInt32LE(entryOffset + 12);
    if (bytesInResource <= 0 || imageOffset <= 0 || imageOffset + bytesInResource > buffer.length) {
      return false;
    }
  }
  return true;
}
