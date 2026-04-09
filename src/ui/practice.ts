import { App, Modal, Notice, Setting } from "obsidian";
import { FlashcardData } from "../types";

function renderTemplate(template: string, card: FlashcardData): string {
  return template
    .replace(/\{\{title\}\}/g, card.word)
    .replace(/\{\{(\w+)\}\}/g, (_, key) => card.frontmatter[key] ?? "");
}

export class PracticeSetupModal extends Modal {
  private allCards: FlashcardData[];
  private filterKeys: string[];
  private cardFront: string;
  private cardBack: string;
  private selectedFilters: Map<string, Set<string>>;
  private cardCount: number | "all";
  private order: "random" | "alphabetical";

  constructor(
    app: App,
    cards: FlashcardData[],
    filterKeys: string[],
    cardFront: string,
    cardBack: string
  ) {
    super(app);
    this.allCards = cards;
    this.filterKeys = filterKeys;
    this.cardFront = cardFront;
    this.cardBack = cardBack;
    this.cardCount = 10;
    this.order = "random";

    this.selectedFilters = new Map();
    for (const key of filterKeys) {
      const values = new Set(
        cards.map((c) => c.frontmatter[key] ?? "").filter((v) => v !== "")
      );
      this.selectedFilters.set(key, new Set(values));
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("practice-setup-modal");
    contentEl.createEl("h2", { text: "Practice flashcards" });
    contentEl.createEl("p", {
      text: `${this.allCards.length} flashcard(s) available`,
      cls: "practice-setup-subtitle",
    });

    new Setting(contentEl)
      .setName("Number of cards")
      .addDropdown((dd) => {
        dd.addOption("5", "5");
        dd.addOption("10", "10");
        dd.addOption("20", "20");
        dd.addOption("all", "All");
        dd.setValue("10");
        dd.onChange((v) => {
          this.cardCount = v === "all" ? "all" : parseInt(v);
        });
      });

    for (const key of this.filterKeys) {
      const allValues = [...(this.selectedFilters.get(key) ?? [])].sort();
      if (allValues.length <= 1) continue;

      const label = key.replace(/_/g, " ");
      const setting = new Setting(contentEl).setName(label);
      const container = setting.controlEl.createDiv({ cls: "practice-wc-checkboxes" });

      for (const val of allValues) {
        const lbl = container.createEl("label", { cls: "practice-wc-label" });
        const cb = lbl.createEl("input", { type: "checkbox" });
        cb.checked = true;
        cb.addEventListener("change", () => {
          const selected = this.selectedFilters.get(key)!;
          if (cb.checked) selected.add(val);
          else selected.delete(val);
        });
        lbl.appendText(" " + val);
      }
    }

    new Setting(contentEl)
      .setName("Order")
      .addDropdown((dd) => {
        dd.addOption("random", "Random");
        dd.addOption("alphabetical", "Alphabetical");
        dd.setValue("random");
        dd.onChange((v) => {
          this.order = v as "random" | "alphabetical";
        });
      });

    const btnContainer = contentEl.createDiv({ cls: "modal-button-container" });
    btnContainer.createEl("button", { text: "Start", cls: "mod-cta" })
      .addEventListener("click", () => this.startPractice());
  }

  private startPractice() {
    let cards = this.allCards.filter((card) => {
      for (const [key, selectedValues] of this.selectedFilters) {
        const cardValue = card.frontmatter[key] ?? "";
        if (selectedValues.size > 0 && !selectedValues.has(cardValue)) return false;
      }
      return true;
    });

    if (cards.length === 0) {
      new Notice("No cards match the selected filters.");
      return;
    }

    if (this.order === "random") {
      cards = cards.sort(() => Math.random() - 0.5);
    } else {
      cards = cards.sort((a, b) => a.word.localeCompare(b.word));
    }

    if (this.cardCount !== "all") {
      cards = cards.slice(0, this.cardCount);
    }

    this.close();
    new PracticeModal(this.app, cards, this.cardFront, this.cardBack).open();
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class PracticeModal extends Modal {
  private cards: FlashcardData[];
  private cardFront: string;
  private cardBack: string;
  private currentIndex: number;
  private results: ("know" | "dont_know")[];
  private isFlipped: boolean;
  private boundKeyHandler: (e: KeyboardEvent) => void;

  constructor(app: App, cards: FlashcardData[], cardFront: string, cardBack: string) {
    super(app);
    this.cards = cards;
    this.cardFront = cardFront;
    this.cardBack = cardBack;
    this.currentIndex = 0;
    this.results = [];
    this.isFlipped = false;
    this.boundKeyHandler = this.handleKey.bind(this);
  }

  onOpen() {
    this.modalEl.addClass("practice-modal");
    document.addEventListener("keydown", this.boundKeyHandler);
    this.renderCard();
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!this.isFlipped) this.flipCard();
    } else if (e.key === "ArrowRight" && this.isFlipped) {
      this.answer("know");
    } else if (e.key === "ArrowLeft" && this.isFlipped) {
      this.answer("dont_know");
    }
  }

  private renderCard() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("practice-content");

    const card = this.cards[this.currentIndex];
    const total = this.cards.length;
    const current = this.currentIndex + 1;

    const progressWrapper = contentEl.createDiv({ cls: "practice-progress" });
    progressWrapper.createEl("span", { text: `${current} / ${total}` });
    const bar = progressWrapper.createDiv({ cls: "practice-bar" });
    const fill = bar.createDiv({ cls: "practice-bar-fill" });
    fill.style.width = `${(current / total) * 100}%`;

    const cardEl = contentEl.createDiv({ cls: "practice-card" });
    cardEl.createEl("div", {
      text: renderTemplate(this.cardFront, card),
      cls: "practice-word",
    });

    if (!this.isFlipped) {
      contentEl.createDiv({ cls: "practice-hint" }).setText("Press space or click to reveal");
      cardEl.addEventListener("click", () => this.flipCard());
    } else {
      cardEl.addClass("flipped");
      cardEl.createEl("div", { cls: "practice-divider" });
      cardEl.createEl("div", {
        text: renderTemplate(this.cardBack, card),
        cls: "practice-translation",
      });

      const btns = contentEl.createDiv({ cls: "practice-buttons" });
      btns.createEl("button", { text: "✗  Don't know  ←", cls: "practice-btn-dont-know" })
        .addEventListener("click", () => this.answer("dont_know"));
      btns.createEl("button", { text: "✓  Know it  →", cls: "practice-btn-know" })
        .addEventListener("click", () => this.answer("know"));
    }
  }

  private flipCard() {
    this.isFlipped = true;
    this.renderCard();
  }

  private answer(result: "know" | "dont_know") {
    this.results.push(result);
    this.currentIndex++;
    this.isFlipped = false;
    if (this.currentIndex >= this.cards.length) {
      this.renderResults();
    } else {
      this.renderCard();
    }
  }

  private renderResults() {
    const { contentEl } = this;
    contentEl.empty();

    const known = this.results.filter((r) => r === "know").length;
    const total = this.cards.length;

    contentEl.createEl("h2", { text: "Session complete!" });

    const scoreEl = contentEl.createDiv({ cls: "practice-score" });
    scoreEl.createEl("span", { text: `${known}`, cls: "practice-score-num" });
    scoreEl.createEl("span", { text: ` / ${total}` });

    const bar = contentEl.createDiv({ cls: "practice-bar practice-bar-result" });
    bar.createDiv({ cls: "practice-bar-fill" }).style.width = `${(known / total) * 100}%`;

    const missed = this.cards.filter((_, i) => this.results[i] === "dont_know");
    if (missed.length > 0) {
      contentEl.createEl("h3", { text: "Words to review" });
      const list = contentEl.createEl("ul", { cls: "practice-missed" });
      for (const card of missed) {
        const li = list.createEl("li");
        const link = li.createEl("a", {
          text: `${renderTemplate(this.cardFront, card)}  →  ${renderTemplate(this.cardBack, card)}`,
          cls: "practice-missed-link",
        });
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.close();
          void this.app.workspace.getLeaf("tab").openFile(card.file);
        });
      }
    } else {
      contentEl.createEl("p", { text: "Perfect score! 🎉", cls: "practice-perfect" });
    }

    contentEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Close", cls: "mod-cta" })
      .addEventListener("click", () => this.close());
  }

  onClose() {
    document.removeEventListener("keydown", this.boundKeyHandler);
    this.contentEl.empty();
  }
}
