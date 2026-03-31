import { App, Modal } from "obsidian";

export class FlashcardInputModal extends Modal {
  private onSubmit: (text: string) => void;
  private language: string;

  constructor(app: App, language: string, onSubmit: (text: string) => void) {
    super(app);
    this.language = language;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Create ${this.language} Flashcard` });

    const inputEl = contentEl.createEl("input", {
      type: "text",
      placeholder: `Type a ${this.language} word or phrase…`,
    });
    inputEl.style.width = "100%";
    inputEl.style.padding = "8px";
    inputEl.style.marginBottom = "12px";
    inputEl.focus();

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && inputEl.value.trim().length > 0) {
        this.close();
        this.onSubmit(inputEl.value.trim());
      }
    });

    const btnContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const submitBtn = btnContainer.createEl("button", {
      text: "Create",
      cls: "mod-cta",
    });
    submitBtn.addEventListener("click", () => {
      if (inputEl.value.trim().length > 0) {
        this.close();
        this.onSubmit(inputEl.value.trim());
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
