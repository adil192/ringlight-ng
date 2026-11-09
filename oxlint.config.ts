// oxlint-disable no-inline-comments capitalized-comments

import { defineConfig } from 'oxlint';

export default defineConfig({
	categories: {
		correctness: 'error',
		pedantic: 'warn',
		perf: 'warn',
		// style: 'warn',
		suspicious: 'warn',
	},
	ignorePatterns: ['dist/**', 'venv/**'],
	options: {
		typeAware: true,
	},
	overrides: [
		{
			files: ['src/**'],
			rules: {
				'sort-keys': 'off', // 'width' should come before 'height'
			},
		},
	],
	rules: {
		curly: 'off', // I like single-line if statements
		'eslint/max-params': 'off', // Meh
		'eslint/no-continue': 'off', // Guard statements are good for readability
		'eslint/no-inline-comments': 'off', // Generally bad but sometimes good
		'eslint/no-magic-numbers': 'off', // False positives
		'eslint/no-multi-assign': 'off', // Can make code cleaner to alias a field
		'eslint/no-negated-condition': 'off', // Useless
		'eslint/no-redeclare': 'off', // interface merging used a lot in gjs
		'eslint/no-ternary': 'off', // I like ternaries
		'eslint/no-underscore-dangle': 'off', // gnome-shell uses lots of underscore-prefixed names
		'eslint/sort-imports': [
			'warn',
			{
				allowSeparatedGroups: true,
				ignoreCase: true,
			},
		],
		'id-length': 'off', // Single letter variables are usually bad but I only use them when it's intuitive, like x and y coordinates.
		'no-shadow': 'off', // Typically done on purpose
		'one-var': 'off', // Why!
		'typescript/consistent-return': 'off', // Prefer TypeScript's noImplicitReturns
		'typescript/no-confusing-void-expression': 'off', // Forbids void-returning functions in expressions for no reason
		'typescript/strict-void-return': 'off', // As above
		'typescript/prefer-readonly-parameter-types': 'off', // Overly verbose
		'typescript/restrict-template-expressions': ['warn', { // Allow arrays since json.stringify is too verbose
			allowArray: true,
		}],
		'unicorn/consistent-function-scoping': 'off', // Unnecessary aliasing especially if function only used once
		'unicorn/no-array-sort': 'off', // It's usually preferable to mutate the array in-place rather than creating a new one
		'unicorn/no-negated-condition': 'off', // Useless
		'unicorn/no-null': 'off', // Why!
		'unicorn/no-unreadable-array-destructuring': 'off', // The alternative is much more verbose
		'unicorn/prefer-global-this': 'off', // globalThis != global in GJS
		'unicorn/prefer-ternary': 'off', // If statements are sometimes more readable.
	},
});
