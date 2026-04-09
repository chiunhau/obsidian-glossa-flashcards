import { App, PluginSettingTab, Setting } from "obsidian";
import type FlashcardPlugin from "./main";
import { PluginSettings } from "./types";

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
  // licenseKey: "",  // Pro — not yet released
};

export class FlashcardSettingTab extends PluginSettingTab {
  plugin: FlashcardPlugin;

  constructor(app: App, plugin: FlashcardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── General ───────────────────────────────────────────────────────────────

    new Setting(containerEl).setName("General").setHeading();

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Google AI API key. Get one at aistudio.google.com/apikey")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.geminiApiKey)
          .then((t) => {
            t.inputEl.type = "password";
            t.inputEl.addClass("glossa-input-wide");
          })
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Gemini model (e.g. gemini-2.5-flash-lite, gemini-2.5-flash).")
      .addText((text) =>
        text
          .setPlaceholder("E.g. gemini-2.5-flash-lite")
          .setValue(this.plugin.settings.geminiModel)
          .then((t) => {
            t.inputEl.addClass("glossa-input-medium");
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

    new Setting(containerEl).setName("Generation").setHeading();

    new Setting(containerEl)
      .setName("Language")
      .setDesc("Language you are learning. Available in the prompt as {{language}}.")
      .addText((text) =>
        text
          .setPlaceholder("E.g. Finnish")
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
            t.inputEl.addClass("glossa-setting-textarea");
            t.inputEl.setCssProps({ "--glossa-textarea-height": "160px" });
          })
          .onChange(async (value) => {
            this.plugin.settings.customPrompt = value;
            await this.plugin.saveSettings();
          })
      );
    promptSetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", () => {
        this.plugin.settings.customPrompt = DEFAULT_PROMPT;
        void this.plugin.saveSettings().then(() => this.display());
      });

    // ── Output ────────────────────────────────────────────────────────────────

    new Setting(containerEl).setName("Output").setHeading();

    const outputFieldsSetting = new Setting(containerEl)
      .setName("Output fields")
      .setDesc("One per line: field_key: description. The AI returns each field as structured data; descriptions guide its output.")
      .addTextArea((text) =>
        text
          .setPlaceholder("E.g. translation: English translation")
          .setValue(this.plugin.settings.outputFields)
          .then((t) => {
            t.inputEl.addClass("glossa-setting-textarea");
            t.inputEl.setCssProps({ "--glossa-textarea-height": "180px" });
          })
          .onChange(async (value) => {
            this.plugin.settings.outputFields = value;
            await this.plugin.saveSettings();
          })
      );
    outputFieldsSetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", () => {
        this.plugin.settings.outputFields = DEFAULT_OUTPUT_FIELDS;
        void this.plugin.saveSettings().then(() => this.display());
      });

    

    // ── Note ──────────────────────────────────────────────────────────────────

    new Setting(containerEl).setName("Note").setHeading();

    new Setting(containerEl)
      .setName("Title")
      .setDesc("Output field whose value becomes the note filename.")
      .addText((text) =>
        text
          .setPlaceholder("E.g. dictionary_form")
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
            t.inputEl.addClass("glossa-setting-textarea");
            t.inputEl.setCssProps({ "--glossa-textarea-height": "120px" });
          })
          .onChange(async (value) => {
            this.plugin.settings.noteBodyTemplate = value;
            await this.plugin.saveSettings();
          })
      );
    bodySetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", () => {
        this.plugin.settings.noteBodyTemplate = DEFAULT_NOTE_BODY_TEMPLATE;
        void this.plugin.saveSettings().then(() => this.display());
      });

    const propertiesSetting = new Setting(containerEl)
      .setName("Properties")
      .setDesc("One per line: propertyKey: value. Use {{fieldKey}} for AI output, {{source_text}} for the original selected text. JSON arrays are supported (e.g. [\"[[Tag]]\"]).")
      .addTextArea((text) =>
        text
          .setPlaceholder("word_class: {{word_class}}\ntranslation: {{translation}}\ngroup: Default")
          .setValue(this.plugin.settings.frontmatterConfig)
          .then((t) => {
            t.inputEl.addClass("glossa-setting-textarea");
            t.inputEl.setCssProps({ "--glossa-textarea-height": "140px" });
          })
          .onChange(async (value) => {
            this.plugin.settings.frontmatterConfig = value;
            await this.plugin.saveSettings();
          })
      );
    propertiesSetting.settingEl.addClass("setting-full-width");

    containerEl.createDiv({ cls: "modal-button-container" })
      .createEl("button", { text: "Reset to default" })
      .addEventListener("click", () => {
        this.plugin.settings.frontmatterConfig = DEFAULT_FRONTMATTER_CONFIG;
        void this.plugin.saveSettings().then(() => this.display());
      });

    // ── Practice ──────────────────────────────────────────────────────────────

    new Setting(containerEl).setName("Practice").setHeading();

    const cardFrontSetting = new Setting(containerEl)
      .setName("Card front")
      .setDesc("Template for the front of each practice card. Use {{title}} for the note title, or {{propertyKey}} for any note property.")
      .addTextArea((text) =>
        text
          .setPlaceholder("{{title}}")
          .setValue(this.plugin.settings.practiceCardFront)
          .then((t) => {
            t.inputEl.addClass("glossa-setting-textarea");
            t.inputEl.setCssProps({ "--glossa-textarea-height": "80px" });
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
            t.inputEl.addClass("glossa-setting-textarea");
            t.inputEl.setCssProps({ "--glossa-textarea-height": "80px" });
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
          .setPlaceholder("E.g. word_class, group")
          .setValue(this.plugin.settings.practiceFilters)
          .then((t) => { t.inputEl.addClass("glossa-input-medium"); })
          .onChange(async (value) => {
            this.plugin.settings.practiceFilters = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
