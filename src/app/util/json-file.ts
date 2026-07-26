export abstract class JsonFile {
	static download(filename: string, data: unknown): void {
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = filename;
		anchor.click();

		URL.revokeObjectURL(url);
	}

	static async read(file: File): Promise<unknown> {
		const text = await file.text();

		return JSON.parse(text);
	}
}
