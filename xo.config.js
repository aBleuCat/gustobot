export default {
	prettier: "compat",
	space: false,
	semicolon: true,
	ignores: [
		"**/node_modules/**",
		"**/.pnpm/**",
		"**/*.md",
		"dist/**",
		"build/**",
		"xo.config.js",
	],
	rules: {
		"curly": ["error", "multi-line"],
		"id-denylist": ["error", "command"],
		"@typescript-eslint/strict-boolean-expressions": "off",
		"@typescript-eslint/naming-convention": [
			"error",
			{
				selector: "variable",
				format: ["camelCase", "UPPER_CASE"],
				leadingUnderscore: "allow"
			},
			{
				selector: "parameter",
				format: ["camelCase"],
				leadingUnderscore: "allow"
			},
			{
				selector: "typeLike",
				format: ["PascalCase"]
			}
		],
		"no-unused-vars": ["error", {varsIgnorePattern: "^_"}]
	}
};
