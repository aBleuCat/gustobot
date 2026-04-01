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

// Import all models from models file
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

// Resolves the model name and file name based on 'd' shortcuts
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
        modelName: modelName,
        timestamp: Date.now(),
        fields: Object.keys(Model.schema.paths),
        data: docs.map(({ _id, __v, ...rest }) => rest)
    };

    fs.writeFileSync(fileName, JSON.stringify(output, null, 2));
    console.log(`Success: Saved ${docs.length} records.`);
    process.exit(0);
}

async function compare(modelArg, fileArg, isPush = false) {
    const { Model, modelName, fileName } = resolveArgs(modelArg, fileArg);
    
    if (!fs.existsSync(fileName)) {
        console.error(`Error: File ${fileName} not found.`);
        process.exit(1);
    }

    const fileContent = JSON.parse(fs.readFileSync(fileName, 'utf8'));
    await connectDB();
    const dbCount = await Model.countDocuments();

    const timeString = new Date(fileContent.timestamp).toLocaleString();
    const timeDiffHours = ((Date.now() - fileContent.timestamp) / 3600000).toFixed(2);

    console.log(`--- Comparison: ${modelName} ---`);
    console.log(`Backup Name: ${fileContent.modelName}`);
    console.log(`Backup Time: ${timeString} (${timeDiffHours} hours ago)`);
    console.log(`Fields:      ${fileContent.fields.join(', ')}`);
    console.log(`Record Count: File (${fileContent.data.length}) vs DB (${dbCount})`);
    console.log(`-----------------------------`);

    return { fileContent, modelName, match: fileContent.modelName === modelName };
}

async function push(modelArg, fileArg, forceArg) {
    const { fileContent, modelName, match } = await compare(modelArg, fileArg, true);
    const isForced = forceArg === 'force';

    if (!match) {
        console.log(`MISMATCH: File contains data for '${fileContent.modelName}' but you are pushing to '${modelName}'.`);
        if (!isForced) {
            console.error("Push failed. Use 'force' at the end to override.");
            process.exit(1);
        }
        console.log("Force flag detected. Proceeding with override...");
    }

    const confirm = await askQuestion(`Type 'yes' to DELETE DB data and replace with backup: `);
    if (confirm.toLowerCase() === 'yes') {
        const { Model } = resolveArgs(modelArg, fileArg);
        await Model.deleteMany({});
        await Model.insertMany(fileContent.data);
        console.log("Database successfully updated.");
    } else {
        console.log("Push aborted.");
    }
    process.exit(0);
}

// CLI Logic
const [,, command, model, file, force] = process.argv;

if (!command || !model || !file) {
    console.log("Usage: node dbstash.js [pull|push|compare] [model|d] [file|d] [force (optional)]");
    process.exit(1);
}

switch (command) {
    case 'pull': pull(model, file); break;
    case 'push': push(model, file, force); break;
    case 'compare': compare(model, file).then(() => process.exit(0)); break;
    default: console.log("Unknown command."); process.exit(1);
}