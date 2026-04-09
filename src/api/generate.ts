import { type App, Notice, TFile, normalizePath, requestUrl } from "obsidian";
import type { PluginSettings } from "../types";
import { ensureFolderExists, sanitizeFilename } from "../utils/file";

// Pro (hidden — not yet released)
// export const PRO_API_BASE = "https://glossaflashcards.vercel.app";

interface OutputField {
	key: string;
	description: string;
}

function parseOutputFields(str: string): OutputField[] {
	return str
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const idx = line.indexOf(":");
			if (idx === -1) return { key: line, description: "" };
			return {
				key: line.slice(0, idx).trim(),
				description: line.slice(idx + 1).trim(),
			};
		})
		.filter((f) => f.key.length > 0);
}

function buildJsonSchema(fields: OutputField[]): object {
	const properties: Record<string, object> = {};
	for (const f of fields) {
		properties[f.key] = f.description
			? { type: "string", description: f.description }
			: { type: "string" };
	}
	return {
		type: "object",
		properties,
		required: fields.map((f) => f.key),
	};
}

function renderTemplate(
	template: string,
	data: Record<string, string>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

function parseFrontmatterConfig(
	config: string,
	flashcard: Record<string, string>,
	sourceText: string,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const line of config.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const idx = trimmed.indexOf(":");
		if (idx === -1) continue;

		const key = trimmed.slice(0, idx).trim();
		let value = trimmed.slice(idx + 1).trim();

		value = value.replace(/\{\{source_text\}\}/g, sourceText);
		value = value.replace(
			/\{\{(\w+)\}\}/g,
			(_, field) => flashcard[field] ?? "",
		);

		if (value.startsWith("[") || value.startsWith("{")) {
			try {
				result[key] = JSON.parse(value);
				continue;
			} catch {
				// fall through to string
			}
		}
		result[key] = value;
	}
	return result;
}

async function callDirectGemini(
	settings: PluginSettings,
	sourceText: string,
): Promise<Record<string, string>> {
	if (!settings.geminiApiKey) {
		throw new Error(
			"Gemini API key not set. Go to Settings → Flashcard Generator to add your key.",
		);
	}

	const fields = parseOutputFields(settings.outputFields);
	if (fields.length === 0) {
		throw new Error(
			"No output fields defined. Check Settings → Output Schema.",
		);
	}

	const prompt = settings.customPrompt
		.replace(/\{\{language\}\}/g, settings.language)
		.replace(/\{\{source_text\}\}/g, sourceText.trim());

	const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent?key=${settings.geminiApiKey}`;

	const response = await requestUrl({
		url,
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			contents: [{ parts: [{ text: prompt }] }],
			generationConfig: {
				responseMimeType: "application/json",
				responseSchema: buildJsonSchema(fields),
			},
		}),
		throw: false,
	});

	if (response.status !== 200) {
		const errMsg = response.json?.error?.message ?? `Gemini error (${response.status})`;
		throw new Error(errMsg);
	}

	const text: string = response.json?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!text) throw new Error("Empty response from Gemini.");

	return JSON.parse(text) as Record<string, string>;
}

// Pro (hidden — not yet released)
// async function callProProxy(
// 	settings: PluginSettings,
// 	sourceText: string,
// ): Promise<Record<string, string>> {
// 	const response = await requestUrl({
// 		url: `${PRO_API_BASE}/api/generate`,
// 		method: "POST",
// 		headers: { "Content-Type": "application/json" },
// 		body: JSON.stringify({
// 			licenseKey: settings.licenseKey,
// 			sourceText: sourceText.trim(),
// 			prompt: settings.customPrompt,
// 			outputFields: settings.outputFields,
// 			language: settings.language,
// 			model: settings.geminiModel,
// 		}),
// 		throw: false,
// 	});
//
// 	if (response.status === 429) {
// 		throw new Error(
// 			response.json?.error ??
// 				"Weekly card limit reached. Upgrade or wait until next week.",
// 		);
// 	}
// 	if (response.status === 401) {
// 		throw new Error("Invalid or expired license key. Check Settings → Pro.");
// 	}
// 	if (response.status !== 200) {
// 		throw new Error(
// 			response.json?.error ?? `Server error (${response.status})`,
// 		);
// 	}
//
// 	return response.json.output as Record<string, string>;
// }

async function createNote(
	app: App,
	settings: PluginSettings,
	flashcard: Record<string, string>,
	sourceText: string,
): Promise<string | null> {
	const rawTitle = flashcard[settings.titleField] as string | undefined;
	const noteTitle = sanitizeFilename(rawTitle ?? "");

	if (noteTitle.length === 0) {
		new Notice(
			`Title field "${settings.titleField}" is empty or missing in the AI response.`,
		);
		return null;
	}

	const folder = settings.folder.trim();
	const filePath = folder
		? normalizePath(`${folder}/${noteTitle}.md`)
		: `${noteTitle}.md`;

	if (folder) {
		await ensureFolderExists(app, folder);
	}

	const existingFile = app.vault.getAbstractFileByPath(filePath);

	if (existingFile) {
		const leaf = app.workspace.getLeaf("tab");
		await leaf.openFile(existingFile as TFile);
		new Notice(`"${noteTitle}" already exists — opened it.`);
		return noteTitle;
	}

	const body = renderTemplate(settings.noteBodyTemplate, flashcard);
	const newFile = await app.vault.create(filePath, body);

	const fmValues = parseFrontmatterConfig(
		settings.frontmatterConfig,
		flashcard,
		sourceText.trim(),
	);
	await app.fileManager.processFrontMatter(newFile, (frontmatter) => {
		for (const [k, v] of Object.entries(fmValues)) {
			frontmatter[k] = v;
		}
	});

	const leaf = app.workspace.getLeaf("tab");
	await leaf.openFile(newFile);
	new Notice(`Created flashcard: ${noteTitle}`);
	return noteTitle;
}

export async function generateFlashcard(
	app: App,
	settings: PluginSettings,
	sourceText: string,
): Promise<string | null> {
	if (!sourceText || sourceText.trim().length === 0) {
		new Notice("Please enter some text.");
		return null;
	}

	const loadingNotice = new Notice("Generating flashcard…", 0);

	try {
		const flashcard = await callDirectGemini(settings, sourceText);

		loadingNotice.hide();
		return await createNote(app, settings, flashcard, sourceText);
	} catch (err: unknown) {
		loadingNotice.hide();
		const message = err instanceof Error ? err.message : String(err);
		new Notice(`Flashcard generation failed: ${message}`);
		console.error("Flashcard error:", err);
		return null;
	}
}
