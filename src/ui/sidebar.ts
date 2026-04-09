import { ItemView, normalizePath } from "obsidian";
import type { WorkspaceLeaf, TFile } from "obsidian";
import type FlashcardPlugin from "../main";
import { loadFlashcardNotes } from "../utils/file";
import type { FlashcardData } from "../types";
import { PracticeSetupModal } from "./practice";

export const VIEW_TYPE_FLASHCARDS_SIDEBAR = "glossa-flashcard-sidebar";

export class FlashcardsSidebarView extends ItemView {
  plugin: FlashcardPlugin;
  private lastActiveFile: TFile | null = null;

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

  onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile === this.lastActiveFile) return;
        this.updateView();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.updateView();
      })
    );

    this.updateView();
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    this.contentEl.empty();
    return Promise.resolve();
  }

  updateView() {
    const container = this.contentEl;
    container.empty();
    container.addClass("glossa-sidebar-container");

    const activeFile = this.app.workspace.getActiveFile();
    this.lastActiveFile = activeFile;
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

    const header = container.createDiv({
      cls: "glossa-sidebar-header",
      attr: { style: "display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;" }
    });

    header.createEl("h4", {
      text: `Flashcards (${cards.length})`,
      attr: { style: "margin: 0; font-weight: 600;" }
    });

    const practiceBtn = header.createEl("button", {
      cls: "glossa-sidebar-practice-btn mod-cta",
      attr: { style: "cursor: pointer; padding: 4px 10px; font-size: 0.85em; border-radius: 4px;", "aria-label": "Practice these flashcards" }
    });
    practiceBtn.setText("Practice");
    practiceBtn.addEventListener("click", () => {
      const filterKeys = this.plugin.settings.practiceFilters
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      new PracticeSetupModal(
        this.app,
        cards,
        filterKeys,
        this.plugin.settings.practiceCardFront,
        this.plugin.settings.practiceCardBack
      ).open();
    });

    const list = container.createDiv({
      cls: "glossa-sidebar-list",
      attr: { style: "display: flex; flex-direction: column; gap: 10px;" }
    });

    for (const card of cards) {
      const cardEl = list.createDiv({ cls: "glossa-sidebar-card" });
      cardEl.addEventListener("mouseover", (event) => {
        this.app.workspace.trigger("hover-link", {
          event,
          source: VIEW_TYPE_FLASHCARDS_SIDEBAR,
          hoverParent: this,
          targetEl: cardEl,
          linktext: card.file.basename,
          sourcePath: card.file.path,
        });
      });

      cardEl.addEventListener("click", () => {
        void this.app.workspace.openLinkText(card.file.basename, card.file.path, "tab");
      });

      cardEl.createEl("span", {
        text: card.word,
        cls: "glossa-sidebar-card-title",
      });

      const translation = card.frontmatter["translation"] || "";

      cardEl.createDiv({
        text: translation,
        cls: "glossa-sidebar-card-translation",
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
