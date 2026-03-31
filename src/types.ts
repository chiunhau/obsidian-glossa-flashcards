import { TFile } from "obsidian";

export interface PluginSettings {
  folder: string;
  geminiApiKey: string;
  geminiModel: string;
  language: string;
  customPrompt: string;
  // Output schema
  outputFields: string;
  titleField: string;
  // Note generation
  noteBodyTemplate: string;
  frontmatterConfig: string;
  // Practice
  practiceCardFront: string;
  practiceCardBack: string;
  practiceFilters: string;
  // Pro
  licenseKey: string;
}

export interface ProStats {
  cardsThisWeek: number;
  cardsTotal: number;
  weeklyLimit: number;
  status: "active" | "expired" | "invalid";
}

export interface FlashcardData {
  file: TFile;
  word: string;
  frontmatter: Record<string, string>;
}
