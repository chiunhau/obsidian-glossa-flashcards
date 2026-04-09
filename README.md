# Glossa Flashcards

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/chiunhau)

Turn any text into living vocabulary — an Obsidian plugin that uses AI to generate rich flashcards from selected text, plus a browser extension to capture words from any webpage.

## Features

### AI Flashcard Generation
Select any word or phrase in Obsidian and let Gemini generate a structured flashcard: dictionary form, word class, translation, and example sentences. Each flashcard is saved as its own note and linked inline to your source text.

You can also create a flashcard manually (without AI) to fill in the fields yourself.

### Browser Extension
Select text on any webpage, right-click, and choose **"Create glossa flashcard from selection"**. The text is handed off to Obsidian via a custom URL scheme and the flashcard is generated automatically — no copy-pasting.

### Sidebar View
Open the flashcards sidebar to see all flashcards linked to your currently active note at a glance.

### Practice Mode
Practice your flashcards with a simple card-flip interface. Filter by any property (e.g. word class, group) or practice all flashcards linked to a specific note. The order is randomised each session.

### Fully Customisable
Every part of the pipeline is configurable: the AI prompt, output fields, note body template, frontmatter properties, card front/back templates, and practice filters. The defaults are set up for vocabulary learning (Finnish, but any language works).

---

## Installation

### Obsidian Plugin — via BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) lets you install plugins that are not yet in the community directory.

1. Install **BRAT** from the Obsidian Community Plugins.
2. Open **Settings → BRAT → Add Beta Plugin**.
3. Enter the repository URL: `https://github.com/chiunhau/glossa-flashcards-plugin`
4. Click **Add Plugin**, then enable **Glossa Flashcards** in **Settings → Community Plugins**.

### Obsidian Plugin — Manual

1. Go to the [latest release](https://github.com/chiunhau/glossa-flashcards-plugin/releases/latest) and download `main.js`, `manifest.json`, and `styles.css`.
2. In your vault, create the folder `.obsidian/plugins/glossa-flashcards/`.
3. Move the three downloaded files into that folder.
4. In Obsidian, go to **Settings → Community Plugins**, enable community plugins if prompted, and toggle on **Glossa Flashcards**.

### API Key Setup

Glossa uses the Google Gemini API, which has a free tier.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and generate an API key.
2. In Obsidian, open **Settings → Glossa Flashcards**.
3. Paste your key into the **API key** field.

The default model is `gemini-2.5-flash-lite`. You can change it to any Gemini model ID (e.g. `gemini-2.5-flash`) in the same settings page.

---

## Browser Extension

You can install the official extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/glossa-flashcards-for-obs/iadipobehkajgdochdfippdapcdokjmj).

Once installed, select any text on a webpage, right-click, and choose **"Create glossa flashcard from selection"**. Obsidian must be open for the handoff to work.

### Manual Installation (Developer)

1. Clone or download this repository.
2. In Chrome (or any Chromium browser), go to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `apps/extension/` folder.

---

## Usage

| Action | How |
|---|---|
| Create flashcard from selected text (AI) | Select text → right-click → *Create flashcard for "…"*, or use the command palette |
| Create flashcard manually | Select text → right-click → *Create flashcard for "…" manually* |
| Create flashcard from typed input | Click the ribbon icon or run *Create flashcard from input* |
| Open sidebar | Click the sidebar ribbon icon or run *Open flashcards sidebar* |
| Practice all flashcards | Click the practice ribbon icon or run *Practice flashcards* |
| Practice flashcards from current note | Right-click in editor → *Practice all flashcards in current note* |

After AI generation, the selected text in your note is automatically replaced with a wiki-link to the new flashcard (e.g. `[[juosta|run]]`).

---

## Configuration

All settings are under **Settings → Glossa Flashcards**.

| Setting | Description |
|---|---|
| API key | Your Google AI Studio key |
| Model | Gemini model ID |
| Flashcards folder | Where notes are saved (default: `Flashcards/`) |
| Language | Language you're learning — injected into the AI prompt |
| Prompt | Full AI prompt; supports `{{language}}` and `{{source_text}}` |
| Output fields | `fieldKey: description` pairs defining what the AI returns |
| Title | Which output field becomes the note filename |
| Body | Note body template using `{{fieldKey}}` placeholders |
| Properties | Frontmatter config using `{{fieldKey}}` or `{{source_text}}` |
| Card front / back | Practice card templates using `{{title}}` or any property key |
| Filter fields | Comma-separated property keys available as filters in practice setup |

## License

MIT
