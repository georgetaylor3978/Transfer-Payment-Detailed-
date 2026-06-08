const fs = require('fs');
const readline = require('readline');
const path = require('path');

const csvPath = 'C:/Users/kroon/.gemini/antigravity/playground/TransferDetail/TransferDetail.csv';
const mapPath = 'C:/Users/kroon/.gemini/antigravity/playground/TransferDetail/AgencyMap.csv';
const outJsonPath = 'C:/Users/kroon/.gemini/antigravity/playground/pyro-lagoon/transfer-detail/data.json';

function parseCSVLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current.trim());
    return parts;
}

// 1. Load AgencyMap
const agencyToDept = {};
const deptsSet = new Set(['Other / Unmapped']);
if (fs.existsSync(mapPath)) {
    const mapContent = fs.readFileSync(mapPath, 'utf8');
    const mapLines = mapContent.split(/\r?\n/);
    for (const line of mapLines) {
        if (!line.trim() || line.startsWith('Department,Agency')) continue;
        const parts = parseCSVLine(line);
        if (parts.length >= 2) {
            const dept = parts[0] || 'Other / Unmapped';
            const agency = parts[1];
            if (agency) {
                agencyToDept[agency.toLowerCase()] = dept;
                deptsSet.add(dept);
            }
        }
    }
}
const departments = Array.from(deptsSet).sort();
const deptToIndex = {};
departments.forEach((d, idx) => { deptToIndex[d] = idx; });

console.log(`Loaded ${departments.length} departments from AgencyMap.`);

// 2. Setup Dictionaries
const agencies = [];
const agencyToIndex = {};
const programs = [];
const programToIndex = {};
const programShortNames = [];
const shortNameToIndex = {};
const locations = [];
const locationToIndex = {};
const cities = [];
const cityToIndex = {};
const recipientGroups = [];
const groupToIndex = {};
const recipients = [];
const recipientToIndex = {};

// Helper to get index
function getIndex(val, list, map) {
    const cleanVal = (val || 'Unknown').trim();
    const key = cleanVal.toLowerCase();
    if (map[key] !== undefined) return map[key];
    const idx = list.length;
    list.push(cleanVal);
    map[key] = idx;
    return idx;
}

const agencyToDeptIndex = [];

const rl = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity
});

let lineCount = 0;
const records = [];

rl.on('line', (line) => {
    lineCount++;
    if (lineCount === 1) return; // Header

    const parts = parseCSVLine(line);
    if (parts.length < 11) return;

    const year = parseInt(parts[0], 10) || 0;
    const agencyName = parts[1] || 'Unknown';
    const programName = parts[2] || 'Unknown';
    const programShortName = parts[3] || 'Unknown';
    const location = parts[6] || 'Unknown';
    const city = parts[7] || 'Unknown';
    const recipientGroup = parts[8] || 'Unknown';
    const recipient = parts[9] || 'Unknown';
    const amount = parseFloat(parts[10]) || 0;

    const agencyIdx = getIndex(agencyName, agencies, agencyToIndex);
    
    // Map agency to department
    if (agencyToDeptIndex[agencyIdx] === undefined) {
        const deptName = agencyToDept[agencyName.toLowerCase()] || 'Other / Unmapped';
        agencyToDeptIndex[agencyIdx] = deptToIndex[deptName];
    }

    const programIdx = getIndex(programName, programs, programToIndex);
    const shortNameIdx = getIndex(programShortName, programShortNames, shortNameToIndex);
    const locationIdx = getIndex(location, locations, locationToIndex);
    const cityIdx = getIndex(city, cities, cityToIndex);
    const groupIdx = getIndex(recipientGroup, recipientGroups, groupToIndex);
    const recipientIdx = getIndex(recipient, recipients, recipientToIndex);

    // Record structure: [year, agencyIdx, programIdx, shortNameIdx, locationIdx, cityIdx, groupIdx, recipientIdx, amount]
    records.push([
        year,
        agencyIdx,
        programIdx,
        shortNameIdx,
        locationIdx,
        cityIdx,
        groupIdx,
        recipientIdx,
        amount
    ]);
});

rl.on('close', () => {
    console.log(`Processed ${lineCount - 1} records from CSV.`);
    
    const db = {
        departments,
        agencies,
        agencyToDeptIndex,
        programs,
        programShortNames,
        locations,
        cities,
        recipientGroups,
        recipients,
        records
    };

    console.log('Writing data.json...');
    fs.writeFileSync(outJsonPath, JSON.stringify(db));
    
    const sizeMB = (fs.statSync(outJsonPath).size / 1024 / 1024).toFixed(2);
    console.log(`data.json written successfully! Size: ${sizeMB} MB`);
    console.log(`Unique Recipients: ${recipients.length}`);
    console.log(`Unique Programs: ${programs.length}`);
    console.log(`Unique Cities: ${cities.length}`);
});
