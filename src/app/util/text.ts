export abstract class Text {
	static fromUpperCaseToSentenceCase(upperCaseName: string): string {
		return upperCaseName
			.toLowerCase()
			.split('_')
			.map((word, index) => (0 === index ? word.charAt(0).toUpperCase() + word.slice(1) : word))
			.join(' ');
	}

	static fromKebabCaseToSentenceCase(upperCaseName: string): string {
		return upperCaseName
			.split('-')
			.map((word, index) => (0 === index ? word.charAt(0).toUpperCase() + word.slice(1) : word))
			.join(' ');
	}
}
