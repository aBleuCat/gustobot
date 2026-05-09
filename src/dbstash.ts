import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as Models from './lib/models.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({path: path.join(__dirname, '.env')});
const ModelsMap = Models as unknown as ModelMap;

const {MONGO_URI} = process.env;

type ModelMap = Record<string, any>;

type CompareResult = {
	fileContent: any;
	modelName: string;
	nameMatch: boolean;
	fieldsMatch: boolean;
	primaryKey?: string | undefined;
};

async function connectDB(): Promise<void> {
	if (!MONGO_URI) {
		console.error('Error: MONGO_URI not found in .env file.');
		process.exit(1);
	}

	if (mongoose.connection.readyState === 0) {
		await mongoose.connect(MONGO_URI);
	}
}

async function askQuestion(query: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise<string>((resolve) => {
		rl.question(query, (ans: string) => {
			rl.close();
			resolve(ans);
		});
	});
}

type ResolveArgsResult = {
	Model: any;
	modelName: string;
	fileName: string;
};

function resolveArgs(modelArg: string, fileArg: string): ResolveArgsResult {
	const modelName = modelArg === 'd' ? 'UserHorses' : modelArg;
	const fileName = fileArg === 'd' ? '../backups/dbbackup.json' : fileArg;
	const Model = ModelsMap[modelName];
	if (!Model) {
		console.error(`Error: Model '${modelName}' not found in lib/models.js`);
		process.exit(1);
	}

	return {Model, modelName, fileName};
}

async function pull(modelArg: string, fileArg: string): Promise<void> {
	const {Model, modelName, fileName} = resolveArgs(modelArg, fileArg);
	await connectDB();
	console.log(`Pulling ${modelName} to ${fileName}...`);
	const docs = await Model.find({}).lean();

	const output = {
		modelName,
		timestamp: Date.now(),
		fields: Object.keys(Model.schema.paths).filter(
			(p: string) => p !== '__v' && p !== '_id',
		),
		data: docs.map(({_id, __v, ...rest}: any) => rest),
	};

	fs.writeFileSync(fileName, JSON.stringify(output, null, 2));
	console.log(`Success: Saved ${docs.length} records.`);
}

async function compare(
	modelArg: string,
	fileArg: string,
): Promise<CompareResult> {
	const {Model, modelName, fileName} = resolveArgs(modelArg, fileArg);
	if (!fs.existsSync(fileName)) {
		console.error(`Error: File ${fileName} not found.`);
		process.exit(1);
	}

	const fileContent = JSON.parse(fs.readFileSync(fileName, 'utf8'));
	await connectDB();

	const dbData = await Model.find({}).lean();
	const dbFields = Object.keys(Model.schema.paths)
		.filter((p: string) => p !== '__v' && p !== '_id')
		.sort();
	const fileFields = (fileContent.fields || []).sort();

	const nameMatch = fileContent.modelName === modelName;
	const fieldsMatch = JSON.stringify(dbFields) === JSON.stringify(fileFields);

	console.log(`--- Comparison: ${modelName} ---`);
	console.log(
		`Backup Model: ${fileContent.modelName} [${nameMatch ? 'MATCH' : 'MISMATCH'}]`,
	);
	console.log(`Fields Match: ${fieldsMatch ? '✅' : '❌'}`);
	console.log(
		`Counts:       File(${fileContent.data.length}) vs DB(${dbData.length})`,
	);

	const primaryKey = dbFields.find((f: string) =>
		['userId', 'ruleId', 'guildId', 'id', 'channelId'].includes(f),
	);
	const fileMap = new Map(
		fileContent.data.map((item: any, idx: number) => [
			primaryKey ? String(item[primaryKey]) : idx,
			item,
		]),
	);
	const dbMap = new Map(
		dbData.map((item: any, idx: number) => [
			primaryKey ? String(item[primaryKey]) : idx,
			item,
		]),
	);

	let diffCount = 0;
	for (const [key, dbItem] of dbMap) {
		if (!fileMap.has(key)) {
			console.log(`[MISSING IN FILE] Key: ${key}`);
			diffCount++;
			continue;
		}

		const fileItem = fileMap.get(key);
		const changes: string[] = [];

		dbFields.forEach((field: string) => {
			const fileItemValue = (fileItem as any)?.[field];
			const dbItemValue = (dbItem as any)?.[field];
			if (
				fileItemValue !== undefined &&
				JSON.stringify(dbItemValue) !== JSON.stringify(fileItemValue)
			) {
				changes.push(
					`${field}: (DB) ${JSON.stringify(dbItemValue)} != (File) ${JSON.stringify(fileItemValue)}`,
				);
			}
		});

		if (changes.length > 0) {
			console.log(`[MODIFIED] Key: ${key}`);
			for (const c of changes) console.log(`   └─ ${c}`);
			diffCount++;
		}
	}

	if (diffCount === 0) console.log('✨ No value differences found.');
	console.log(`-----------------------------`);

	return {fileContent, modelName, nameMatch, fieldsMatch, primaryKey};
}

async function push(
	modelArg: string,
	fileArg: string,
	optionArg?: string,
): Promise<void> {
	const {fileContent, modelName, nameMatch, fieldsMatch, primaryKey} =
		await compare(modelArg, fileArg);
	const isForced = optionArg === 'force';
	const isMerge = optionArg === 'merge';

	if (!nameMatch || (!fieldsMatch && !isMerge)) {
		console.log(`\n❌ PUSH PREVENTED: Data mismatch.`);
		if (!isForced && !isMerge) {
			console.error(
				"Aborting. Use 'force' to overwrite or 'merge' to update existing fields.",
			);
			process.exit(1);
		}
	}

	const modeText = isMerge
		? 'MERGE (update existing, keep new fields)'
		: 'OVERWRITE (delete everything first)';
	const confirm = await askQuestion(
		`\n⚠️  MODE: ${modeText}\nType 'yes' to proceed: `,
	);

	if (confirm.toLowerCase() === 'yes') {
		const {Model} = resolveArgs(modelArg, fileArg);

		if (isMerge) {
			if (!primaryKey) {
				console.error(
					'Merge failed: Could not find a unique key (userId/ruleId) to match records.',
				);
				process.exit(1);
			}

			const ops = fileContent.data.map((item: any) => ({
				updateOne: {
					filter: {[primaryKey]: item[primaryKey]},
					update: {$set: item},
					upsert: true, // Creates the user if they exist in file but not in DB
				},
			}));
			await Model.bulkWrite(ops);
			console.log(`\n✅ Successfully merged ${ops.length} records.`);
		} else {
			await Model.deleteMany({});
			await Model.insertMany(fileContent.data);
			console.log(`\n✅ Database for ${modelName} successfully overwritten.`);
		}
	} else {
		console.log('\nPush cancelled.');
	}
}

// CLI Logic
const [, , command, model, file, option] = process.argv;
if (!command || !model || !file) {
	console.log(
		'Usage: node dbstash.js [pull|push|compare] [model|d] [file|d] [force|merge]',
	);
	process.exit(1);
}

type ActionFunction = (
	modelArg: string,
	fileArg: string,
	optionArg?: string,
) => Promise<any>;
type Actions = {
	pull: ActionFunction;
	push: ActionFunction;
	compare: ActionFunction;
};

const actions: Actions = {pull, push, compare};

if (actions[command as keyof Actions]) {
	actions[command as keyof Actions](model, file, option)
		.then(() => {
			mongoose.connection.close();
			process.exit(0);
		})
		.catch((error: Error) => {
			console.error(error);
			process.exit(1);
		});
}
