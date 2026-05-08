const fs = require('node:fs');
const path = require('node:path');

const horsesPath = path.join(__dirname, '../horses.json');
const configPath = path.join(__dirname, '../lib/config.js');

let horsesData;
let config;

try {
	horsesData = JSON.parse(fs.readFileSync(horsesPath));
	// Require the config object specifically
	config = require(configPath).config;
} catch (error) {
	console.error('Error loading files:', error.message);
	process.exit(1);
}

const horseKeys = Object.keys(horsesData);

// Chance = 1 / (value * SPAWN_COEFFICIENT * ANTIINFLATOR)
function calculateChance(value) {
	const denominator = value * config.SPAWN_COEFFICIENT * config.ANTIINFLATOR;
	return 1 / denominator;
}

function getStats() {
	console.log('--- Horse Spawn Probabilities (Per Message) ---');
	console.log(
		`Config: Coeff=${config.SPAWN_COEFFICIENT}, Anti-Inflator=${config.ANTIINFLATOR.toFixed(4)}\n`,
	);

	let totalRate = 0;

	const stats = horseKeys.map((key) => {
		const horse = horsesData[key];
		const chance = calculateChance(horse.value);
		totalRate += chance;
		return {
			name: horse.name,
			value: horse.value,
			prob: (chance * 100).toFixed(6) + '%',
			oneInX: Math.round(1 / chance).toLocaleString(),
		};
	});

	// Sort by value (rarest first)
	stats.sort((a, b) => b.value - a.value);

	console.table(stats);
	console.log(
		`\nTotal chance of any horse spawning per message: ${(totalRate * 100).toFixed(4)}%`,
	);
	console.log(`(Roughly 1 horse every ${Math.round(1 / totalRate)} messages)`);
}

function spinWheel() {
	console.log('--- Rolling for Horse... ---');

	const pool = horseKeys.map((key) => ({
		key,
		weight: calculateChance(horsesData[key].value),
	}));

	const totalWeight = pool.reduce((sum, h) => sum + h.weight, 0);
	let random = Math.random() * totalWeight;

	for (const item of pool) {
		if (random < item.weight) {
			const horse = horsesData[item.key];
			console.log(`Result: ${horse.name}`);
			console.log(`Value: ${horse.value}`);
			console.log(`Link:  ${horse.link}`);
			return;
		}

		random -= item.weight;
	}
}

const mode = process.argv[2];
if (mode === 'stats') {
	getStats();
} else if (mode === 'wheel') {
	spinWheel();
} else {
	console.log('Usage: node horsechance.js [stats|wheel]');
}
