import { App, PluginSettingTab, Setting, requestUrl } from "obsidian";
import type FlashcardPlugin from "./main";
import { PluginSettings, ProStats } from "./types";
import { PRO_API_BASE } from "./api/generate";

export const DEFAULT_PROMPT = `You are a {{language}} language expert.
Extract the word or short phrase from the following text and generate a flashcard for it.
Text to extract from: "{{source_text}}"`;

export const DEFAULT_OUTPUT_FIELDS = `dictionary_form: Base/dictionary form of the word
word_class: Grammatical category (e.g. noun, verb, adjective, adverb, etc.)
translation: English translation
example_1: First example sentence
example_1_translation: English translation of first example
example_2: Second example sentence
example_2_translation: English translation of second example`;

export const DEFAULT_NOTE_BODY_TEMPLATE = `- {{example_1}} ({{example_1_translation}})
- {{example_2}} ({{example_2_translation}})`;

export const DEFAULT_FRONTMATTER_CONFIG = `translation: {{translation}}
word_class: {{word_class}}
group: Default
source: {{source_text}}`;

export const DEFAULT_CARD_FRONT = `{{title}}`;

export const DEFAULT_CARD_BACK = `{{translation}} ({{word_class}})`;

export const DEFAULT_SETTINGS: PluginSettings = {
  folder: "Flashcards",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash-lite",
  language: "Finnish",
  customPrompt: DEFAULT_PROMPT,
  outputFields: DEFAULT_OUTPUT_FIELDS,
  titleField: "dictionary_form",
  noteBodyTemplate: DEFAULT_NOTE_BODY_TEMPLATE,
  frontmatterConfig: DEFAULT_FRONTMATTER_CONFIG,
  practiceCardFront: DEFAULT_CARD_FRONT,
  practiceCardBack: DEFAULT_CARD_BACK,
  practiceFilters: "word_class, group",
  licenseKey: "",
};

export class FlashcardSettingTab extends PluginSettingTab {
  plugin: FlashcardPlugin;

  constructor(app: App, plugin: FlashcardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private async fetchProStats(el: HTMLElement): Promise<void> {
    try {
      const response = await requestUrl({
        url: `${PRO_API_BASE}/api/stats`,
        method: "GET",
        headers: {
          "x-license-key": this.plugin.settings.licenseKey,
        },
      });
      const stats: ProStats = response.json;
      el.empty();
      el.createEl("strong", { text: "Glossa Pro" });
      el.createEl("br");
      el.createSpan({ text: `Cards this week: ${stats.cardsThisWeek} / ${stats.weeklyLimit}` });
      el.createEl("br");
      el.createSpan({ text: `Cards all time: ${stats.cardsTotal}` });
      el.createEl("br");
      el.createSpan({
        text: `Status: ${stats.status}`,
        cls: stats.status === "active" ? "mod-success" : "mod-warning",
      });
    } catch {
      el.setText("Could not load stats. Check your license key or internet connection.");
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Pro ───────────────────────────────────────────────────────────────────

    containerEl.createEl("h2", { text: "Pro" });

    new Setting(containerEl)
      .setName("License key")
      .setDesc("Glossa Pro license key. When set, no Gemini API key is needed.")
      .addText((text) =>
        text
          .setPlaceholder("XXXX-XXXX-XXXX-XXXX")
          .setValue(this.plugin.settings.licenseKey)
          .then((t) => {
            t.inputEl.type = "password";
            t.inputEl.style.width = "300px";
          })
          .onChange(async (value) => {
            this.plugin.settings.licenseKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    if (!this.plugin.settings.licenseKey) {
      const upgradeEl = containerEl.createDiv();
      upgradeEl.style.marginBottom = "16px";
      upgradeEl.style.fontSize = "0.9em";
      upgradeEl.createSpan({ text: "No API key required, 150 cards/week, usage stats. " });
      const link = upgradeEl.createEl("a", { text: "Get Glossa Pro →" });
      link.href = "https://glossaflashcards.vercel.app/#pricing";
      link.style.fontWeight = "600";
    }

    if (this.plugin.settings.licenseKey) {
      const statsEl = containerEl.createDiv({ cls: "glossa-pro-stats" });
      statsEl.style.padding = "12px 16px";
      statsEl.style.background = "var(--background-secondary)";
      statsEl.style.borderRadius = "6px";
      statsEl.style.marginBottom = "16px";
      statsEl.style.fontSize = "0.9em";
      statsEl.setText("Loading stats…");

      this.fetchProStats(statsEl);
    }

    // ── General ───────────────────────────────────────────────────────────────

    containerEl.createEl("h2", { text: "General" });

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Google AI API key. Get one at aistudio.google.com/apikey")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.geminiApiKey)
          .then((t) => {
            t.inputEl.type = "password";
            t.inputEl.style.width = "300px";
          })
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Gemini model ID (e.g. gemini-2.5-flash-lite, gemini-2.5-flash).")
      .addText((text) =>
        text
          .setPlaceholder("gemini-2.5-flash-lite")
          .setValue(this.plugin.settings.geminiModel)
          .then((t) => {
            t.inputEl.style.width = "250px";
          })
          .onChange(async (value) => {
            this.plugin.settings.geminiModel = value.trim() || "gemini-2.5-flash-lite";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Flashcards folder")
      .setDesc("Where flashcard notes are saved, relative to vault root. Leave empty to use vault root.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. Finnish/Flashcards")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Generation ────────────────────────────────────────────────────────────

    containerEl.createEl("h2", { text: "Generation" });

    new Setting(containerEl)
      .setName("Language")
      .setDesc("Language you are learning. Available in the prompt as {{language}}.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. Finnish")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value;
            await this.plugin.saveSettings();
          })
      );

    const promptSetting = new Setting(containerEl)
      .setName("Prompt")
      .setDesc("Sent to the AI with {{language}} and {{source_text}} substituted. The output fields below define what structured data the AI must return.")
      .addTextArea((text) =>
        text
          .setPlaceholder("Enter prompt...")
          .setValue(this.plugin.settings.customPrompt)
          .then((t) => {
            t.inputEl.style.width = "100%";
            t.inputEl.style.height = "160px";
            t.inputEl.style.fontFamily = "monospace";
            t.inputEl.style.fontSize = "0.85em";
          })
          .onChange(async (value) => {
            this.plugin.settings.customPrompt = value;
            await this.plugin.saveSettings();
          })
      );
    promptSetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", async () => {
        this.plugin.settings.customPrompt = DEFAULT_PROMPT;
        await this.plugin.saveSettings();
        this.display();
      });

    // ── Output ────────────────────────────────────────────────────────────────

    containerEl.createEl("h2", { text: "Output" });

    const outputFieldsSetting = new Setting(containerEl)
      .setName("Output fields")
      .setDesc("One per line: fieldKey: Description. The AI returns each field as structured data; descriptions guide its output.")
      .addTextArea((text) =>
        text
          .setPlaceholder("field_key: Description for the AI")
          .setValue(this.plugin.settings.outputFields)
          .then((t) => {
            t.inputEl.style.width = "100%";
            t.inputEl.style.height = "180px";
            t.inputEl.style.fontFamily = "monospace";
            t.inputEl.style.fontSize = "0.85em";
          })
          .onChange(async (value) => {
            this.plugin.settings.outputFields = value;
            await this.plugin.saveSettings();
          })
      );
    outputFieldsSetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", async () => {
        this.plugin.settings.outputFields = DEFAULT_OUTPUT_FIELDS;
        await this.plugin.saveSettings();
        this.display();
      });

    

    // ── Note ──────────────────────────────────────────────────────────────────

    containerEl.createEl("h2", { text: "Note" });

    new Setting(containerEl)
      .setName("Title")
      .setDesc("Output field whose value becomes the note filename.")
      .addText((text) =>
        text
          .setPlaceholder("dictionary_form")
          .setValue(this.plugin.settings.titleField)
          .onChange(async (value) => {
            this.plugin.settings.titleField = value.trim();
            await this.plugin.saveSettings();
          })
      );

    const bodySetting = new Setting(containerEl)
      .setName("Body")
      .setDesc("Note content template. Use {{fieldKey}} to insert AI output fields.")
      .addTextArea((text) =>
        text
          .setPlaceholder("{{example_1}} ({{example_1_translation}})")
          .setValue(this.plugin.settings.noteBodyTemplate)
          .then((t) => {
            t.inputEl.style.width = "100%";
            t.inputEl.style.height = "120px";
            t.inputEl.style.fontFamily = "monospace";
            t.inputEl.style.fontSize = "0.85em";
          })
          .onChange(async (value) => {
            this.plugin.settings.noteBodyTemplate = value;
            await this.plugin.saveSettings();
          })
      );
    bodySetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", async () => {
        this.plugin.settings.noteBodyTemplate = DEFAULT_NOTE_BODY_TEMPLATE;
        await this.plugin.saveSettings();
        this.display();
      });

    const propertiesSetting = new Setting(containerEl)
      .setName("Properties")
      .setDesc("One per line: propertyKey: value. Use {{fieldKey}} for AI output, {{source_text}} for the original selected text. JSON arrays are supported (e.g. [\"[[Tag]]\"]).")
      .addTextArea((text) =>
        text
          .setPlaceholder("word_class: {{word_class}}\ntranslation: {{translation}}\ngroup: Default")
          .setValue(this.plugin.settings.frontmatterConfig)
          .then((t) => {
            t.inputEl.style.width = "100%";
            t.inputEl.style.height = "140px";
            t.inputEl.style.fontFamily = "monospace";
            t.inputEl.style.fontSize = "0.85em";
          })
          .onChange(async (value) => {
            this.plugin.settings.frontmatterConfig = value;
            await this.plugin.saveSettings();
          })
      );
    propertiesSetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", async () => {
        this.plugin.settings.frontmatterConfig = DEFAULT_FRONTMATTER_CONFIG;
        await this.plugin.saveSettings();
        this.display();
      });

    // ── Practice ──────────────────────────────────────────────────────────────

    containerEl.createEl("h2", { text: "Practice" });

    const cardFrontSetting = new Setting(containerEl)
      .setName("Card front")
      .setDesc("Template for the front of each practice card. Use {{title}} for the note title, or {{propertyKey}} for any note property.")
      .addTextArea((text) =>
        text
          .setPlaceholder("{{title}}")
          .setValue(this.plugin.settings.practiceCardFront)
          .then((t) => {
            t.inputEl.style.width = "100%";
            t.inputEl.style.height = "80px";
            t.inputEl.style.fontFamily = "monospace";
            t.inputEl.style.fontSize = "0.85em";
          })
          .onChange(async (value) => {
            this.plugin.settings.practiceCardFront = value;
            await this.plugin.saveSettings();
          })
      );
    cardFrontSetting.settingEl.addClass("setting-full-width");

    const cardBackSetting = new Setting(containerEl)
      .setName("Card back")
      .setDesc("Template for the back of each practice card. Use {{title}} for the note title, or {{propertyKey}} for any note property.")
      .addTextArea((text) =>
        text
          .setPlaceholder("{{translation}}")
          .setValue(this.plugin.settings.practiceCardBack)
          .then((t) => {
            t.inputEl.style.width = "100%";
            t.inputEl.style.height = "80px";
            t.inputEl.style.fontFamily = "monospace";
            t.inputEl.style.fontSize = "0.85em";
          })
          .onChange(async (value) => {
            this.plugin.settings.practiceCardBack = value;
            await this.plugin.saveSettings();
          })
      );
    cardBackSetting.settingEl.addClass("setting-full-width");

    new Setting(containerEl)
      .setName("Filter fields")
      .setDesc("Comma-separated property keys shown as filter options in the practice setup. Each becomes a checkbox group of all unique values found in your notes.")
      .addText((text) =>
        text
          .setPlaceholder("word_class, group")
          .setValue(this.plugin.settings.practiceFilters)
          .then((t) => { t.inputEl.style.width = "250px"; })
          .onChange(async (value) => {
            this.plugin.settings.practiceFilters = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
