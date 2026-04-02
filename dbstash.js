/*
node dbstash.js [pull/push/compare] [model|d] [file|d] [force (optional)]
d defaults to UserHorses model and dbbackup.json file
pull: pulls data from specified model and saves to file. If file exists, it will be overwritten.
push: pushes data from file to specified model. WARNING: THIS WILL DELETE ALL DATA IN THE MODEL BEFORE PUSHING. Use 'force' flag to override model name mismatch.
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
        modelName, // Storing the name for future push verification
        timestamp: Date.now(),
        fields: Object.keys(Model.schema.paths).filter(p => p !== '__v'),
        data: docs.map(({ _id, __v, ...rest }) => rest)
    };

    fs.writeFileSync(fileName, JSON.stringify(output, null, 2));
    console.log(`Success: Saved ${docs.length} records.`);
    process.exit(0);
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
    const dbFields = Object.keys(Model.schema.paths).filter(p => p !== '__v').sort();
    const fileFields = (fileContent.fields || []).sort();

    const nameMatch = fileContent.modelName === modelName;
    const fieldsMatch = JSON.stringify(dbFields) === JSON.stringify(fileFields);
    const timeDiffHours = ((Date.now() - fileContent.timestamp) / 3600000).toFixed(2);

    console.log(`--- Comparison: ${modelName} ---`);
    console.log(`Backup Model: ${fileContent.modelName} [${nameMatch ? 'MATCH' : 'MISMATCH'}]`);
    console.log(`Backup Time:  ${new Date(fileContent.timestamp).toLocaleString()} (${timeDiffHours}h ago)`);
    console.log(`Fields Match: ${fieldsMatch ? '✅' : '❌'}`);
    console.log(`Counts:       File(${fileContent.data.length}) vs DB(${dbData.length})`);

    // Record Matching logic
    const primaryKey = dbFields.find(f => ['userId', 'ruleId', 'guildId', 'id', 'channelId'].includes(f)) || '_id';
    const fileMap = new Map(fileContent.data.map(item => [String(item[primaryKey]), item]));
    const dbMap = new Map(dbData.map(item => [String(item[primaryKey]), item]));

    let diffCount = 0;
    for (const [id, dbItem] of dbMap) {
        if (!fileMap.has(id)) {
            console.log(`[MISSING IN FILE] ID: ${id}`);
            diffCount++;
            continue;
        }
        const fileItem = fileMap.get(id);
        const changes = [];
        dbFields.forEach(field => {
            if (JSON.stringify(dbItem[field]) !== JSON.stringify(fileItem[field])) {
                changes.push(`${field}: (DB) ${JSON.stringify(dbItem[field])} != (File) ${JSON.stringify(fileItem[field])}`);
            }
        });
        if (changes.length > 0) {
            console.log(`[MODIFIED] ID: ${id}`);
            changes.forEach(c => console.log(`   └─ ${c}`));
            diffCount++;
        }
    }

    for (const id of fileMap.keys()) {
        if (!dbMap.has(id)) {
            console.log(`[NEW IN FILE] ID: ${id}`);
            diffCount++;
        }
    }

    if (diffCount === 0) console.log("noice No value differences found.");
    console.log(`-----------------------------`);

    return { fileContent, modelName, nameMatch, fieldsMatch };
}

async function push(modelArg, fileArg, forceArg) {
    const { fileContent, modelName, nameMatch, fieldsMatch } = await compare(modelArg, fileArg);
    const isForced = forceArg === 'force';

    // STRICT VALIDATION
    if (!nameMatch || !fieldsMatch) {
        console.log(`\n❌ PUSH PREVENTED: Data mismatch.`);
        if (!nameMatch) console.log(`   Expected Model: ${modelName} | File contains: ${fileContent.modelName}`);
        if (!fieldsMatch) console.log(`   Schema fields do not match.`);
        
        if (!isForced) {
            console.error("\nAborting. Use 'force' at the end of the command to ignore this.");
            process.exit(1);
        }
        console.log("Force flag detected. Overriding safety checks. Proceeding with push...");
    }

    const confirm = await askQuestion(`\n⚠️ WARNING: This will WIPE ALL ${modelName} data in the DB.\nType 'yes' to proceed: `);
    
    if (confirm.toLowerCase() === 'yes') {
        const { Model } = resolveArgs(modelArg, fileArg);
        await Model.deleteMany({});
        await Model.insertMany(fileContent.data);
        console.log(`\n✅ Database for ${modelName} successfully updated.`);
    } else {
        console.log("\nPush cancelled.");
    }
    process.exit(0);
}

const [,, command, model, file, force] = process.argv;
if (!command || !model || !file) {
    console.log("Usage: node dbstash.js [pull|push|compare] [model|d] [file|d] [force]");
    process.exit(1);
}

const actions = { pull, push, compare };
if (actions[command]) {
    actions[command](model, file, force)
    .then(() => {
        // close connection and exit
        mongoose.connection.close();
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
} else {
    console.log("Invalid command.");
}
