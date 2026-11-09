import { defineConfig } from 'oxfmt';

export default defineConfig({
	ignorePatterns: ['dist/**', 'venv/**'],
	tabWidth: 2,
	useTabs: true,
	singleQuote: true,
	arrowParens: 'avoid',
	experimentalOperatorPosition: 'start',
	sortImports: {
		groups: [
			'type-import',
			['value-builtin', 'value-external'],
			'type-internal',
			'value-internal',
			['type-parent', 'type-sibling', 'type-index'],
			['value-parent', 'value-sibling', 'value-index'],
			'unknown',
		],
	},
	overrides: [
		{
			files: ['*.yml', '*.yaml'],
			options: {
				tabWidth: 2,
			},
		},
	],
});
