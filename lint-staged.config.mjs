// A single entry so every staged file reaches one lint run (ESLint → Stylelint
// → Prettier, routed by extension inside the script), giving one unified summary
// and a single ESLint startup instead of three. Calls the package script (not
// the file directly) so the command stays defined in one place — `lint:fix`
// runs with --fix --verbose, so the hook shows the full per-file detail.
export default {
	'*.{ts,js,mjs,html,css,scss,json,jsonc,json5,yml,yaml,md}': 'pnpm lint:fix',
};
