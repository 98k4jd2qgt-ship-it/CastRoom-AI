import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const mode = process.argv[2] ?? "validate";
const source = process.argv[3];

if (!source || !["validate", "inspect"].includes(mode)) {
  console.error("Usage: npm run pack:validate -- <path> OR npm run pack:inspect -- <path>");
  process.exit(2);
}

const report = validatePack(source);

if (mode === "inspect") {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

if (report.status === "error") {
  process.exit(1);
}

function validatePack(inputPath) {
  const fullPath = path.resolve(inputPath);
  const sourcePath = normalizePath(fullPath);
  const errors = [];
  const warnings = [];
  const issues = [];
  const files = readPackFiles(fullPath, errors, warnings);
  const manifestText = files.get("manifest.toml")?.text ?? "";
  const manifest = parseManifest(manifestText, errors, warnings);
  const assets = [];

  if (!manifestText) {
    addIssue(errors, issues, "error", "manifest.toml", "Missing manifest.toml.");
  }

  validateManifest(manifest, files, errors, warnings, issues);

  for (const [relativePath, entry] of files.entries()) {
    if (entry.isDirectory) {
      continue;
    }
    if (isExecutablePath(relativePath)) {
      addIssue(errors, issues, "error", relativePath, "Executable/script files are not allowed in character packs.");
      continue;
    }
    if (relativePath.includes("../") || relativePath.startsWith("/") || /^[A-Za-z]:/.test(relativePath)) {
      addIssue(errors, issues, "error", relativePath, "Path traversal or absolute paths are not allowed.");
      continue;
    }

    const format = supportedVisualFormat(relativePath);
    if (!format) {
      continue;
    }

    const folder = assetFolder(relativePath);
    if (!folder) {
      continue;
    }

    const warning =
      format === "jpg" || format === "jpeg"
        ? "JPG/JPEG has no alpha channel; transparent character art should use PNG."
        : format === "gif" && entry.sizeBytes > 8 * 1024 * 1024
          ? "Large GIF may hurt UI responsiveness; animation can fall back to first frame."
          : ["txt", "art", "ansi"].includes(format) && entry.sizeBytes > 32 * 1024
            ? "Text character art should stay under 32KB."
            : format === "ansi"
              ? "ANSI character art is displayed as plain text; colors are not parsed in this version."
          : undefined;
    if (warning) {
      addIssue(warnings, issues, "warning", relativePath, warning);
    }
    assets.push({
      folder,
      fileName: path.posix.basename(relativePath),
      format,
      animated: format === "gif",
      sizeBytes: entry.sizeBytes,
      warning,
    });
  }

  const idleCount = assets.filter((asset) => asset.folder === "idle").length;
  if (idleCount === 0) {
    addIssue(warnings, issues, "warning", "idle", "No idle visual asset found; CastRoom AI will use the text placeholder.");
  }

  const emotionFolders = [...new Set(assets.filter((asset) => asset.folder.startsWith("emotions/")).map((asset) => asset.folder))].sort();
  const status = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ready";

  return {
    sourcePath,
    manifestId: manifest.id ?? null,
    manifestName: manifest.name ?? null,
    checkedAt: new Date().toISOString(),
    status,
    errors,
    warnings,
    issues,
    assets,
    preview: {
      idleCount,
      emotionFolders,
      promptPath: manifest.prompt_path ?? null,
      voicePath: manifest.voice_path ?? null,
      subtitlePath: manifest.subtitle_path ?? null,
      memoryNamespace: manifest.memory_namespace ?? null,
    },
  };
}

function readPackFiles(fullPath, errors, warnings) {
  const stats = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;
  if (!stats) {
    errors.push(`Path does not exist: ${fullPath}`);
    return new Map();
  }
  if (stats.isDirectory()) {
    return readDirectoryFiles(fullPath);
  }
  if (stats.isFile() && fullPath.toLowerCase().endsWith(".zip")) {
    try {
      return readZipFiles(fullPath, warnings);
    } catch (error) {
      errors.push(`Failed to read zip: ${error instanceof Error ? error.message : String(error)}`);
      return new Map();
    }
  }
  errors.push("Path must be a character pack folder or .zip file.");
  return new Map();
}

function readDirectoryFiles(root) {
  const files = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = normalizePath(path.relative(root, full));
      if (entry.isDirectory()) {
        files.set(relative, { isDirectory: true, sizeBytes: 0 });
        walk(full);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(full);
        files.set(relative, {
          isDirectory: false,
          sizeBytes: bytes.length,
          text: isTextPath(relative) ? bytes.toString("utf8") : undefined,
        });
      }
    }
  };
  walk(root);
  return files;
}

function readZipFiles(zipPath, warnings) {
  const data = fs.readFileSync(zipPath);
  const eocdOffset = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0) {
    throw new Error("End of central directory not found.");
  }
  const totalEntries = data.readUInt16LE(eocdOffset + 10);
  const centralOffset = data.readUInt32LE(eocdOffset + 16);
  const files = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (data.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Invalid central directory entry.");
    }
    const method = data.readUInt16LE(cursor + 10);
    const compressedSize = data.readUInt32LE(cursor + 20);
    const uncompressedSize = data.readUInt32LE(cursor + 24);
    const nameLength = data.readUInt16LE(cursor + 28);
    const extraLength = data.readUInt16LE(cursor + 30);
    const commentLength = data.readUInt16LE(cursor + 32);
    const localOffset = data.readUInt32LE(cursor + 42);
    const name = normalizePath(data.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"));
    const isDirectory = name.endsWith("/");
    let text;
    if (!isDirectory && isTextPath(name)) {
      text = readZipEntryText(data, localOffset, method, compressedSize);
    }
    files.set(name.replace(/\/$/, ""), {
      isDirectory,
      sizeBytes: uncompressedSize,
      text,
    });
    if (method !== 0 && method !== 8 && isTextPath(name)) {
      warnings.push(`${name} uses unsupported zip compression method ${method}; text inspection skipped.`);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return stripCommonRoot(files);
}

function readZipEntryText(data, localOffset, method, compressedSize) {
  if (data.readUInt32LE(localOffset) !== 0x04034b50) {
    return undefined;
  }
  const nameLength = data.readUInt16LE(localOffset + 26);
  const extraLength = data.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const compressed = data.subarray(start, start + compressedSize);
  if (method === 0) {
    return compressed.toString("utf8");
  }
  if (method === 8) {
    return zlib.inflateRawSync(compressed).toString("utf8");
  }
  return undefined;
}

function stripCommonRoot(files) {
  const names = [...files.keys()].filter(Boolean);
  const roots = [...new Set(names.map((name) => name.split("/")[0]))];
  if (roots.length !== 1 || files.has("manifest.toml")) {
    return files;
  }
  const root = `${roots[0]}/`;
  const stripped = new Map();
  for (const [name, value] of files.entries()) {
    stripped.set(name.startsWith(root) ? name.slice(root.length) : name, value);
  }
  return stripped;
}

function parseManifest(text, errors, warnings) {
  const values = {};
  let section = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) {
      continue;
    }
    if (line === "[emotions]") {
      section = "emotions";
      continue;
    }
    if (line.startsWith("[")) {
      section = "";
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"$/);
    if (!match) {
      warnings.push(`Ignored unsupported manifest line: ${line}`);
      continue;
    }
    values[section ? `${section}.${match[1]}` : match[1]] = match[2];
  }
  if (!values.id) {
    errors.push("manifest.toml missing id.");
  }
  return values;
}

function validateManifest(manifest, files, errors, warnings, issues) {
  if (manifest.id && !/^[A-Za-z0-9_-]+$/.test(manifest.id)) {
    addIssue(errors, issues, "error", "manifest.toml", "id must use ASCII letters, numbers, '-' or '_'.");
  }
  for (const key of ["prompt_path", "voice_path", "subtitle_path"]) {
    const value = manifest[key] ?? defaultManifestPath(key);
    if (!isSafeRelativePath(value)) {
      addIssue(errors, issues, "error", value, `${key} must be a safe relative path.`);
    } else if (!files.has(value)) {
      addIssue(errors, issues, "error", value, `${key} file does not exist.`);
    }
  }
  const memory = manifest.memory_namespace ?? (manifest.id ? `character:${manifest.id}` : "");
  if (!memory.startsWith("character:")) {
    addIssue(errors, issues, "error", "manifest.toml", "memory_namespace must start with character:.");
  }
  const emotionFolders = Object.entries(manifest)
    .filter(([key]) => key.startsWith("emotions."))
    .map(([, folder]) => folder);
  for (const folder of emotionFolders) {
    if (!isSafeRelativePath(folder)) {
      addIssue(errors, issues, "error", folder, "emotion folder must be a safe relative path.");
    }
  }
  if (!emotionFolders.includes("idle")) {
    warnings.push("No explicit idle emotion mapping; default idle folder will be used.");
  }
}

function addIssue(target, issues, severity, pathValue, message) {
  target.push(message);
  issues.push({ severity, path: pathValue, message });
}

function defaultManifestPath(key) {
  return {
    prompt_path: "prompt/system.md",
    voice_path: "voice.toml",
    subtitle_path: "subtitle.toml",
  }[key];
}

function assetFolder(relativePath) {
  const parts = normalizePath(relativePath).split("/");
  if (parts.length < 2) {
    return null;
  }
  if (parts[0] === "idle") {
    return "idle";
  }
  if (parts[0] === "emotions" && parts.length >= 3) {
    return `emotions/${parts[1]}`;
  }
  return null;
}

function supportedVisualFormat(filePath) {
  const extension = path.posix.extname(normalizePath(filePath)).slice(1).toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "txt", "art", "ansi"].includes(extension) ? extension : null;
}

function isTextPath(filePath) {
  return /\.(toml|md|txt|json)$/i.test(filePath);
}

function isSafeRelativePath(value) {
  const normalized = normalizePath(value);
  return Boolean(normalized) && !normalized.startsWith("/") && !normalized.includes("../") && !/^[A-Za-z]:/.test(normalized);
}

function isExecutablePath(filePath) {
  return /\.(exe|dll|bat|cmd|ps1|sh|msi|scr|com|vbs|js)$/i.test(filePath);
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

function printHumanReport(report) {
  console.log(`CastRoom AI character pack validation: ${report.status}`);
  console.log(`source: ${report.sourcePath}`);
  console.log(`manifest: ${report.manifestName ?? "unknown"} / ${report.manifestId ?? "unknown"}`);
  console.log(`assets: ${report.assets.length}, idle: ${report.preview.idleCount}, emotions: ${report.preview.emotionFolders.join(", ") || "none"}`);
  for (const issue of report.issues) {
    console.log(`${issue.severity.toUpperCase()}: ${issue.path}: ${issue.message}`);
  }
}
