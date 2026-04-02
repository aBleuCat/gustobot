/*
node dbstash.js [pull/push/compare] [model|d] [file|d] [force/merge (optional)]
d defaults to UserHorses model and dbbackup.json file
pull: pulls data from specified model and saves to file. If file exists, it will be overwritten.
push: pushes data from file to specified model. WARNING: THIS WILL DELETE ALL DATA IN THE MODEL BEFORE PUSHING. 
Use 'force' flag to override model name mismatch.
Use 'merge' flag to merge data instead of deleting all records.
before pushing it asks for confirmation and gives a quick comparison
compare: compares the record count and fields of the file and database for the specified model without making any changes.
*/
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Models = require('./lib/models');
const MONGO_URI = process.env.MONGO_URI;

async function connectDB() {
    if (!MONGO_URI) {
        console.error("Error: MONGO_URI not found in .env file.");
        process.exit(1);
    }
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGO_URI);
    }
}

const askQuestion = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
};

function resolveArgs(modelArg, fileArg) {
    const modelName = (modelArg === 'd') ? 'UserHorses' : modelArg;
    const fileName = (fileArg === 'd') ? 'dbbackup.json' : fileArg;
    const Model = Models[modelName];
    if (!Model) {
        console.error(`Error: Model '${modelName}' not found in lib/models.js`);
        process.exit(1);
    }
    return { Model, modelName, fileName };
}

async function pull(modelArg, fileArg) {
    const { Model, modelName, fileName } = resolveArgs(modelArg, fileArg);
    await connectDB();
    console.log(`Pulling ${modelName} to ${fileName}...`);
    const docs = await Model.find({}).lean();
    
    const output = {
        modelName,
        timestamp: Date.now(),
        fields: Object.keys(Model.schema.paths).filter(p => p !== '__v' && p !== '_id'),
        data: docs.map(({ _id, __v, ...rest }) => rest)
    };

    fs.writeFileSync(fileName, JSON.stringify(output, null, 2));
    console.log(`Success: Saved ${docs.length} records.`);
}

async function compare(modelArg, fileArg) {
    const { Model, modelName, fileName } = resolveArgs(modelArg, fileArg);
    if (!fs.existsSync(fileName)) {
        console.error(`Error: File ${fileName} not found.`);
        process.exit(1);
    }

    const fileContent = JSON.parse(fs.readFileSync(fileName, 'utf8'));
    await connectDB();
    
    const dbData = await Model.find({}).lean();
    const dbFields = Object.keys(Model.schema.paths).filter(p => p !== '__v' && p !== '_id').sort();
    const fileFields = (fileContent.fields || []).sort();

    const nameMatch = fileContent.modelName === modelName;
    const fieldsMatch = JSON.stringify(dbFields) === JSON.stringify(fileFields);
    
    console.log(`--- Comparison: ${modelName} ---`);
    console.log(`Backup Model: ${fileContent.modelName} [${nameMatch ? 'MATCH' : 'MISMATCH'}]`);
    console.log(`Fields Match: ${fieldsMatch ? '✅' : '❌'}`);
    console.log(`Counts:       File(${fileContent.data.length}) vs DB(${dbData.length})`);

    const primaryKey = dbFields.find(f => ['userId', 'ruleId', 'guildId', 'id', 'channelId'].includes(f));
    const fileMap = new Map(fileContent.data.map((item, idx) => [primaryKey ? String(item[primaryKey]) : idx, item]));
    const dbMap = new Map(dbData.map((item, idx) => [primaryKey ? String(item[primaryKey]) : idx, item]));

    let diffCount = 0;
    for (const [key, dbItem] of dbMap) {
        if (!fileMap.has(key)) {
            console.log(`[MISSING IN FILE] Key: ${key}`);
            diffCount++;
            continue;
        }
        const fileItem = fileMap.get(key);
        const changes = [];
        
        dbFields.forEach(field => {
            if (fileItem[field] !== undefined && JSON.stringify(dbItem[field]) !== JSON.stringify(fileItem[field])) {
                changes.push(`${field}: (DB) ${JSON.stringify(dbItem[field])} != (File) ${JSON.stringify(fileItem[field])}`);
            }
        });

        if (changes.length > 0) {
            console.log(`[MODIFIED] Key: ${key}`);
            changes.forEach(c => console.log(`   └─ ${c}`));
            diffCount++;
        }
    }

    if (diffCount === 0) console.log("✨ No value differences found.");
    console.log(`-----------------------------`);

    return { fileContent, modelName, nameMatch, fieldsMatch, primaryKey };
}

async function push(modelArg, fileArg, optionArg) {
    const { fileContent, modelName, nameMatch, fieldsMatch, primaryKey } = await compare(modelArg, fileArg);
    const isForced = optionArg === 'force';
    const isMerge = optionArg === 'merge';

    if (!nameMatch || (!fieldsMatch && !isMerge)) {
        console.log(`\n❌ PUSH PREVENTED: Data mismatch.`);
        if (!isForced && !isMerge) {
            console.error("Aborting. Use 'force' to overwrite or 'merge' to update existing fields.");
            process.exit(1);
        }
    }

    const modeText = isMerge ? "MERGE (update existing, keep new fields)" : "OVERWRITE (delete everything first)";
    const confirm = await askQuestion(`\n⚠️  MODE: ${modeText}\nType 'yes' to proceed: `);
    
    if (confirm.toLowerCase() === 'yes') {
        const { Model } = resolveArgs(modelArg, fileArg);

        if (isMerge) {
            if (!primaryKey) {
                console.error("Merge failed: Could not find a unique key (userId/ruleId) to match records.");
                process.exit(1);
            }
            const ops = fileContent.data.map(item => ({
                updateOne: {
                    filter: { [primaryKey]: item[primaryKey] },
                    update: { $set: item },
                    upsert: true // Creates the user if they exist in file but not in DB
                }
            }));
            await Model.bulkWrite(ops);
            console.log(`\n✅ Successfully merged ${ops.length} records.`);
        } else {
            await Model.deleteMany({});
            await Model.insertMany(fileContent.data);
            console.log(`\n✅ Database for ${modelName} successfully overwritten.`);
        }
    } else {
        console.log("\nPush cancelled.");
    }
}

// CLI Logic
const [,, command, model, file, option] = process.argv;
if (!command || !model || !file) {
    console.log("Usage: node dbstash.js [pull|push|compare] [model|d] [file|d] [force|merge]");
    process.exit(1);
}

const actions = { pull, push, compare };
if (actions[command]) {
    actions[command](model, file, option)
        .then(() => {
            mongoose.connection.close();
            process.exit(0);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}