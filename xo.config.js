export default {
	prettier: true,
	space: false,
	semicolon: true,
	rules: {
		"id-denylist": ["error", "command"], // There usually is a more helpful name also I keep accidentally importing command
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
		"no-unused-vars": ["error", { varsIgnorePattern: "^_" }],
	},
};
