export default [
	{
		ignores: [
			"**/node_modules/**",
			"**/.pnpm/**",
			"**/*.md",
			"dist/**",
			"build/**"
		],
	},
	{
		prettier: "compat",
		space: false,
		semicolon: true,
		rules: {
			"@typescript-eslint/strict-boolean-expressions": "off", // This is giving me trauma
			"curly": ["error", "multi-line"],
			"id-denylist": ["error", "command"], 
			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "variable",
					format: ["camelCase", "UPPER_CASE"],
					leadingUnderscore: "allow",
				},
				{
					selector: "parameter",
					format: ["camelCase"],
					leadingUnderscore: "allow",
				},
				{
					selector: "typeLike",
					format: ["PascalCase"],
				},
			],
			"no-unused-vars": ["error", {varsIgnorePattern: "^_"}],
		},
	},
];
