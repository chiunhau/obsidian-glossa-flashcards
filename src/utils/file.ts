import { App, normalizePath, TFolder } from "obsidian";
import { FlashcardData } from "../types";

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  if (!folderPath) return;
  const normalized = normalizePath(folderPath);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing && existing instanceof TFolder) return;
  try {
    await app.vault.createFolder(normalized);
  } catch {
    // folder may already exist
  }
}

function fmValueToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val)) return val.map(String).join(", ");
  return String(val);
}

export function loadFlashcardNotes(app: App, folderPath: string): FlashcardData[] {
  const folder = folderPath.trim();
  const files = app.vault.getMarkdownFiles().filter((f) => {
    if (folder) {
      return f.path.startsWith(normalizePath(folder) + "/");
    }
    return true;
  });

  const cards: FlashcardData[] = [];
  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm) continue;

    const frontmatter: Record<string, string> = {};
    for (const [k, v] of Object.entries(fm)) {
      if (k === "position") continue; // Obsidian internal key
      frontmatter[k] = fmValueToString(v);
    }

    cards.push({ file, word: file.basename, frontmatter });
  }
  return cards;
}
