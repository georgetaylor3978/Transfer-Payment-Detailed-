/* ================================================================
   process_data.js
   Run this from the Transfer-Detail-Dashboard folder:
       node process_data.js

   Reads CSVs from:
       C:\Users\kroon\.gemini\antigravity\playground\TransferDetail\

   Writes data.json to the current directory (dashboard folder).
   ================================================================ */

const fs   = require('fs');
const path = require('path');
const rl   = require('readline');

// ── Paths ──────────────────────────────────────────────────────
const DATA_DIR = 'C:/Users/kroon/.gemini/antigravity/playground/TransferDetail';
const CSV_PATH = path.join(DATA_DIR, 'TransferDetail.csv');
const MAP_PATH = path.join(DATA_DIR, 'AgencyMap.csv');
const OUT_PATH = path.join(__dirname, 'data.json');

// ── Helpers ────────────────────────────────────────────────────
function parseCSVLine(line) {
    const parts = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i+1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) {
            parts.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    parts.push(cur.trim());
    return parts;
}

function getIdx(val, list, map) {
    const key = (val || 'Unknown').trim();
    const lk  = key.toLowerCase();
    if (map[lk] !== undefined) return map[lk];
    const idx = list.length;
    list.push(key);
    map[lk] = idx;
    return idx;
}

// ── 1. Load AgencyMap (Agency → Department) ────────────────────
const agencyToDept = {};

if (!fs.existsSync(MAP_PATH)) {
    console.warn(`WARNING: AgencyMap.csv not found at ${MAP_PATH}. All agencies will be "Other / Unmapped".`);
} else {
    const mapLines = fs.readFileSync(MAP_PATH, 'utf8').split(/\r?\n/);
    for (const line of mapLines) {
        if (!line.trim() || line.startsWith('Department,Agency')) continue;
        const parts = parseCSVLine(line);
        if (parts.length >= 2 && parts[1]) {
            agencyToDept[parts[1].toLowerCase()] = parts[0] || 'Other / Unmapped';
        }
    }
    console.log(`Loaded ${Object.keys(agencyToDept).length} agency→department mappings from AgencyMap.csv`);
}

// Build department list
const deptList  = ['Other / Unmapped'];
const deptMap   = { 'other / unmapped': 0 };
Object.values(agencyToDept).forEach(d => getIdx(d, deptList, deptMap));

// ── 2. Dictionary arrays ───────────────────────────────────────
const agencies         = [], agencyMap        = {};
const programs         = [], programMap       = {};
const programShortNames= [], shortNameMap     = {};
const locations        = [], locationMap      = {};
const cities           = [], cityMap          = {};
const recipientGroups  = [], groupMap         = {};
const recipients       = [], recipientMap     = {};

const agencyToDeptIndex = [];  // agencyIdx → deptIdx

// ── 3. Stream CSV ──────────────────────────────────────────────
if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: TransferDetail.csv not found at ${CSV_PATH}`);
    process.exit(1);
}

console.log(`Reading ${CSV_PATH} ...`);

const reader = rl.createInterface({ input: fs.createReadStream(CSV_PATH), crlfDelay: Infinity });
const records = [];
let lineNum = 0;

reader.on('line', line => {
    lineNum++;
    if (lineNum === 1) return; // skip header

    const p = parseCSVLine(line);
    if (p.length < 11) return;

    const year         = parseInt(p[0], 10) || 0;
    const agencyName   = p[1] || 'Unknown';
    const programName  = p[2] || 'Unknown';
    const shortName    = p[3] || 'Unknown';
    const location     = p[6] || 'Unknown';
    const city         = p[7] || 'Unknown';
    const recGroup     = p[8] || 'Unknown';
    const recipient    = p[9] || 'Unknown';
    const amount       = parseFloat(p[10]) || 0;

    const agIdx = getIdx(agencyName, agencies, agencyMap);

    // Resolve department for this agency (once per unique agency)
    if (agencyToDeptIndex[agIdx] === undefined) {
        const deptName = agencyToDept[agencyName.toLowerCase()] || 'Other / Unmapped';
        agencyToDeptIndex[agIdx] = getIdx(deptName, deptList, deptMap);
    }

    records.push([
        year,
        agIdx,
        getIdx(programName,  programs,          programMap),
        getIdx(shortName,    programShortNames, shortNameMap),
        getIdx(location,     locations,         locationMap),
        getIdx(city,         cities,            cityMap),
        getIdx(recGroup,     recipientGroups,   groupMap),
        getIdx(recipient,    recipients,        recipientMap),
        amount
    ]);
});

reader.on('close', () => {
    console.log(`Processed ${records.length.toLocaleString()} records.`);

    const db = {
        departments:       deptList,
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

    console.log('Writing data.json ...');
    fs.writeFileSync(OUT_PATH, JSON.stringify(db));

    const mb = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2);
    console.log(`Done! data.json is ${mb} MB`);
    console.log(`  Departments: ${deptList.length}`);
    console.log(`  Agencies:    ${agencies.length}`);
    console.log(`  Programs:    ${programs.length}`);
    console.log(`  Recipients:  ${recipients.length}`);
});