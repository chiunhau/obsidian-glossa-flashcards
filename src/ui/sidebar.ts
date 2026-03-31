import { ItemView, normalizePath } from "obsidian";
import type { WorkspaceLeaf, TFile } from "obsidian";
import type FlashcardPlugin from "../main";
import { loadFlashcardNotes } from "../utils/file";
import type { FlashcardData } from "../types";

export const VIEW_TYPE_FLASHCARDS_SIDEBAR = "glossa-flashcard-sidebar";

export class FlashcardsSidebarView extends ItemView {
  plugin: FlashcardPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FlashcardPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_FLASHCARDS_SIDEBAR;
  }

  getDisplayText() {
    return "Flashcards";
  }

  getIcon() {
    return "languages";
  }

  async onOpen() {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.updateView();
      })
    );
    
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.updateView();
      })
    );

    this.updateView();
  }

  async onClose() {
    this.contentEl.empty();
  }

  updateView() {
    const container = this.contentEl;
    container.empty();
    container.addClass("glossa-sidebar-container");

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      container.createEl("p", {
        text: "No active file.",
        cls: "glossa-sidebar-empty",
      });
      return;
    }

    const cards = this.getLinkedFlashcards(activeFile);

    if (cards.length === 0) {
      container.createEl("p", {
        text: "No flashcards linked in the current document.",
        cls: "glossa-sidebar-empty",
        attr: { style: "color: var(--text-muted); font-style: italic; padding: 10px;" }
      });
      return;
    }

    container.createEl("h4", {
      text: `Flashcards (${cards.length})`,
      cls: "glossa-sidebar-header",
      attr: { style: "margin-top: 0; margin-bottom: 20px; font-weight: 600;" }
    });

    const list = container.createDiv({
      cls: "glossa-sidebar-list",
      attr: { style: "display: flex; flex-direction: column; gap: 10px;" }
    });

    for (const card of cards) {
      const cardEl = list.createDiv({
        cls: "glossa-sidebar-card",
        attr: { 
          style: "padding: 12px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background-color: var(--background-secondary); display: flex; flex-direction: column; gap: 4px;"
        }
      });

      cardEl.createDiv({
        text: card.word,
        cls: "glossa-sidebar-card-title",
        attr: { style: "font-weight: bold; font-size: 1.1em; color: var(--text-normal);" }
      });

      const translation = card.frontmatter["translation"] || "";

      cardEl.createDiv({
        text: translation,
        cls: "glossa-sidebar-card-translation",
        attr: { style: "color: var(--text-muted); font-size: 0.9em;" }
      });
    }
  }

  private getLinkedFlashcards(file: TFile): FlashcardData[] {
    const allCards = loadFlashcardNotes(this.app, this.plugin.settings.folder);
    if (allCards.length === 0) {
      return [];
    }

    const resolvedLinks = this.app.metadataCache.resolvedLinks[file.path] ?? {};
    const linkedPaths = new Set(Object.keys(resolvedLinks));

    const flashcardFolder = this.plugin.settings.folder.trim();
    const folderPrefix = flashcardFolder
      ? normalizePath(flashcardFolder) + "/"
      : null;

    return allCards.filter((card) => {
      if (!linkedPaths.has(card.file.path)) return false;
      if (folderPrefix && !card.file.path.startsWith(folderPrefix)) return false;
      return true;
    });
  }
}
