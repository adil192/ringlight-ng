import { defineConfig } from 'oxfmt';

export default defineConfig({
	ignorePatterns: ['dist/**', 'venv/**'],
	tabWidth: 2,
	useTabs: true,
	singleQuote: true,
	arrowParens: 'avoid',
	experimentalOperatorPosition: 'start',
	overrides: [
		{
			files: ['*.yml', '*.yaml'],
			options: {
				tabWidth: 2,
			},
		},
	],
});
