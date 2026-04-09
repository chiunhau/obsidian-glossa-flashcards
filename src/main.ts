import {
  Editor,
  MarkdownView,
  Plugin,
  Notice,
  TFile,
  normalizePath,
} from "obsidian";
import { PluginSettings } from "./types";
import { DEFAULT_SETTINGS, FlashcardSettingTab } from "./settings";
import { generateFlashcard } from "./api/generate";
import { FlashcardInputModal } from "./ui/modals";
import { PracticeSetupModal, PracticeModal } from "./ui/practice";
import { loadFlashcardNotes, sanitizeFilename, ensureFolderExists } from "./utils/file";
import { FlashcardsSidebarView, VIEW_TYPE_FLASHCARDS_SIDEBAR } from "./ui/sidebar";

export default class FlashcardPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FlashcardSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_FLASHCARDS_SIDEBAR,
      (leaf) => new FlashcardsSidebarView(leaf, this)
    );

    this.registerHoverLinkSource(VIEW_TYPE_FLASHCARDS_SIDEBAR, {
      display: "Glossa Flashcards Sidebar",
      defaultMod: false,
    });

    this.addCommand({
      id: "open-flashcards-sidebar",
      name: "Open flashcards sidebar",
      callback: () => {
        void this.activateSidebar();
      },
    });

    this.addRibbonIcon("sidebar-open", "Open flashcards sidebar", () => {
      void this.activateSidebar();
    });

    this.addCommand({
      id: "create-flashcard-from-selection",
      name: "Create flashcard from selection",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        void this.createFlashcard(editor);
      },
    });

    this.addCommand({
      id: "create-flashcard-manual-input",
      name: "Create flashcard from input",
      callback: () => {
        new FlashcardInputModal(this.app, this.settings.language, (text) => {
          void this.createFlashcardFromText(text);
        }).open();
      },
    });

    this.addRibbonIcon("languages", "Create flashcard", () => {
      new FlashcardInputModal(this.app, this.settings.language, (text) => {
        void this.createFlashcardFromText(text);
      }).open();
    });

    this.addRibbonIcon("gallery-vertical-end", "Practice flashcards", () => {
      this.openPracticeSetup();
    });

    this.addCommand({
      id: "practice-flashcards",
      name: "Practice flashcards",
      callback: () => {
        this.openPracticeSetup();
      },
    });

    this.registerObsidianProtocolHandler("glossa-flashcards", async (params) => {
      if (params.text) {
        await this.createFlashcardFromText(params.text);
      }
    });

    this.addCommand({
      id: "practice-flashcards-from-note",
      name: "Practice flashcards from current note",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        if (view.file) this.practiceFromNote(view.file);
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        

        const selection = editor.getSelection();
        if (selection && selection.trim().length > 0) {
          menu.addItem((item) => {
            item
              .setTitle(`Create flashcard for "${selection}"`)
              .setIcon("languages")
              .onClick(() => {
                void this.createFlashcard(editor);
              });
          });

          menu.addItem((item) => {
            item
              .setTitle(`Create flashcard for "${selection}" manually`)
              .setIcon("pencil")
              .onClick(() => {
                void this.createManualFlashcard(editor);
              });
          });
        }

        if (view.file) {
          menu.addItem((item) => {
            item
              .setTitle("Practice all flashcards in current note")
              .setIcon("gallery-vertical-end")
              .onClick(() => this.practiceFromNote(view.file!));
          });
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) => {
          item
            .setTitle("Practice all flashcards in current note")
            .setIcon("gallery-vertical-end")
            .onClick(() => this.practiceFromNote(file));
        });
      })
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async createFlashcard(editor: Editor) {
    const selectedText = editor.getSelection();
    const noteTitle = await generateFlashcard(this.app, this.settings, selectedText);
    if (noteTitle && selectedText) {
      editor.replaceSelection(`[[${noteTitle}|${selectedText}]]`);
    }
  }

  private async createManualFlashcard(editor: Editor) {
    const selectedText = editor.getSelection().trim();
    if (!selectedText) {
      new Notice("Please select some text first.");
      return;
    }

    const noteTitle = sanitizeFilename(selectedText);
    if (noteTitle.length === 0) {
      new Notice("Selected text cannot be used as a filename.");
      return;
    }

    const folder = this.settings.folder.trim();
    const filePath = folder
      ? normalizePath(`${folder}/${noteTitle}.md`)
      : `${noteTitle}.md`;

    if (folder) {
      await ensureFolderExists(this.app, folder);
    }

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(existingFile as TFile);
      new Notice(`"${noteTitle}" already exists — opened it.`);
      editor.replaceSelection(`[[${noteTitle}|${selectedText}]]`);
      return;
    }

    // Build empty body from template (fields will be blank)
    const body = this.settings.noteBodyTemplate.replace(/\{\{\w+\}\}/g, "");

    const newFile = await this.app.vault.create(filePath, body);

    // Build frontmatter with empty field values
    const fmConfig = this.settings.frontmatterConfig;
    if (fmConfig.trim()) {
      await this.app.fileManager.processFrontMatter(newFile, (frontmatter) => {
        for (const line of fmConfig.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf(":");
          if (idx === -1) continue;
          const key = trimmed.slice(0, idx).trim();
          // Set property key with empty value for user to fill in
          frontmatter[key] = "";
        }
      });
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(newFile);
    editor.replaceSelection(`[[${noteTitle}|${selectedText}]]`);
    new Notice(`Created flashcard: ${noteTitle} — fill in the details!`);
  }

  private async createFlashcardFromText(selectedText: string) {
    await generateFlashcard(this.app, this.settings, selectedText);
  }

  private practiceFromNote(file: TFile) {
    const allCards = loadFlashcardNotes(this.app, this.settings.folder);
    if (allCards.length === 0) {
      new Notice("No flashcard notes found. Create some flashcards first!");
      return;
    }

    const resolvedLinks = this.app.metadataCache.resolvedLinks[file.path] ?? {};
    const linkedPaths = new Set(Object.keys(resolvedLinks));

    const flashcardFolder = this.settings.folder.trim();
    const folderPrefix = flashcardFolder
      ? normalizePath(flashcardFolder) + "/"
      : null;

    const cards = allCards.filter((card) => {
      if (!linkedPaths.has(card.file.path)) return false;
      if (folderPrefix && !card.file.path.startsWith(folderPrefix)) return false;
      return true;
    });

    if (cards.length === 0) {
      new Notice(`No flashcard links found in "${file.basename}".`);
      return;
    }

    new PracticeModal(
      this.app,
      cards.sort(() => Math.random() - 0.5),
      this.settings.practiceCardFront,
      this.settings.practiceCardBack
    ).open();
  }

  private openPracticeSetup() {
    const cards = loadFlashcardNotes(this.app, this.settings.folder);
    if (cards.length === 0) {
      new Notice("No flashcard notes found. Create some flashcards first!");
      return;
    }
    const filterKeys = this.settings.practiceFilters
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    new PracticeSetupModal(
      this.app,
      cards,
      filterKeys,
      this.settings.practiceCardFront,
      this.settings.practiceCardBack
    ).open();
  }

  onunload() {}

  async activateSidebar() {
    const { workspace } = this.app;

    let leaf = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARDS_SIDEBAR);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE_FLASHCARDS_SIDEBAR, active: true });
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }
}
