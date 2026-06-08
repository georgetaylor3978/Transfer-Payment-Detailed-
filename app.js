/* ═══════════════════════════════════════════════════════════════
   Transfer Detail Dashboard — app.js
   Records: [year, agencyIdx, programIdx, shortNameIdx, locationIdx, cityIdx, groupIdx, recipientIdx, amount]
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────────
let db = null;

// Selections: -1 = <ALL>
let selDeptIdx     = -1;
let selAgencyIdx   = -1;
let selLocIdx      = -1;
let selectedYear   = null;
let combineAgencies = true;
let themeMode      = 'dark';

// Table
let sortCol = 'amount';
let sortDir = 'desc';
let searchQ = '';

// Charts
let c1 = null;
let c2 = null;

// Color palette
const PALETTE = [
    '#3b82f6','#10b981','#06b6d4','#f59e0b',
    '#ec4899','#8b5cf6','#f97316','#14b8a6',
    '#6366f1','#84cc16','#e11d48','#0ea5e9'
];

// ── 1. BOOTSTRAP ───────────────────────────────────────────────
async function init() {
    const status = document.getElementById('dataStatus');
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        db = await res.json();
    } catch (e) {
        status.textContent = '❌ Load failed';
        status.className = 'data-status error';
        console.error(e);
        return;
    }

    const allYears = getUniqueYears();
    selectedYear = allYears[allYears.length - 1];

    status.textContent = `✓ ${db.records.length.toLocaleString()} records`;
    status.className = 'data-status loaded';

    initTheme();
    buildDeptDropdown();
    buildAgencyDropdown();
    buildLocDropdown();
    buildYearSelect();
    initCombineToggle();
    initTableControls();
    initDropdownDismiss();
    renderAll();
}

// ── 2. HELPERS ─────────────────────────────────────────────────
function getUniqueYears() {
    return [...new Set(db.records.map(r => r[0]))].sort((a, b) => a - b);
}

function getFiltered() {
    let rows = db.records;
    if (selDeptIdx !== -1)   rows = rows.filter(r => db.agencyToDeptIndex[r[1]] === selDeptIdx);
    if (selAgencyIdx !== -1) rows = rows.filter(r => r[1] === selAgencyIdx);
    if (selLocIdx !== -1)    rows = rows.filter(r => r[4] === selLocIdx);
    return rows;
}

function fmtDollar(v) {
    if (!v) return '$0';
    const neg = v < 0;
    const a = Math.abs(v);
    let s = a >= 1e9 ? `$${(a/1e9).toFixed(2)}B`
          : a >= 1e6 ? `$${(a/1e6).toFixed(2)}M`
          : `$${a.toLocaleString('en-CA', {maximumFractionDigits:0})}`;
    return neg ? '-' + s : s;
}

function getThemeVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

// ── 3. DROPDOWNS ───────────────────────────────────────────────
function makeDropdown(triggerId, menuId, searchId, listId, onSelect) {
    const trigger = document.getElementById(triggerId);
    const menu    = document.getElementById(menuId);
    const search  = document.getElementById(searchId);
    const list    = document.getElementById(listId);

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        const wasOpen = menu.classList.contains('open');
        closeAllDropdowns();
        if (!wasOpen) menu.classList.add('open');
    });

    search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        list.querySelectorAll('.dd-item').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });

    list._onSelect = onSelect;
}

function populateList(listId, items, currentIdx, labelFn) {
    // items: [{idx, name}], currentIdx is selected index (-1 = ALL)
    const list = document.getElementById(listId);
    list.innerHTML = '';

    const all = document.createElement('div');
    all.className = 'dd-item' + (currentIdx === -1 ? ' selected' : '');
    all.textContent = '<ALL>';
    all.addEventListener('click', () => list._onSelect(-1, '<ALL>'));
    list.appendChild(all);

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dd-item' + (item.idx === currentIdx ? ' selected' : '');
        div.textContent = labelFn ? labelFn(item) : item.name;
        div.addEventListener('click', () => list._onSelect(item.idx, item.name));
        list.appendChild(div);
    });
}

function setDropdownLabel(triggerId, text) {
    document.querySelector(`#${triggerId} .dropdown-label`).textContent = text;
}

function closeAllDropdowns() {
    ['deptMenu','agencyMenu','locMenu'].forEach(id =>
        document.getElementById(id).classList.remove('open')
    );
}

function initDropdownDismiss() {
    document.addEventListener('click', closeAllDropdowns);
}

// ── Department dropdown ──
function buildDeptDropdown() {
    const items = db.departments.map((name, idx) => ({idx, name}))
        .sort((a, b) => a.name.localeCompare(b.name));

    makeDropdown('deptTrigger','deptMenu','deptSearch','deptList', (idx, name) => {
        selDeptIdx = idx;
        selAgencyIdx = -1;
        setDropdownLabel('deptTrigger', name);
        setDropdownLabel('agencyTrigger', '<ALL>');
        buildAgencyDropdown();
        closeAllDropdowns();
        renderAll();
    });

    populateList('deptList', items, selDeptIdx);
}

// ── Agency dropdown (filtered by dept) ──
function buildAgencyDropdown() {
    let items = db.agencies.map((name, idx) => ({idx, name}));
    if (selDeptIdx !== -1) {
        items = items.filter(item => db.agencyToDeptIndex[item.idx] === selDeptIdx);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));

    makeDropdown('agencyTrigger','agencyMenu','agencySearch','agencyList', (idx, name) => {
        selAgencyIdx = idx;
        setDropdownLabel('agencyTrigger', name);
        closeAllDropdowns();
        renderAll();
    });

    populateList('agencyList', items, selAgencyIdx);
}

// ── Location dropdown ──
function buildLocDropdown() {
    const items = db.locations.map((name, idx) => ({idx, name}))
        .sort((a, b) => a.name.localeCompare(b.name));

    makeDropdown('locTrigger','locMenu','locSearch','locList', (idx, name) => {
        selLocIdx = idx;
        setDropdownLabel('locTrigger', name);
        closeAllDropdowns();
        renderAll();
    });

    populateList('locList', items, selLocIdx);
}

// ── Year select ──
function buildYearSelect() {
    const sel = document.getElementById('yearSelect');
    sel.innerHTML = '';
    const years = getUniqueYears().reverse();
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === selectedYear) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
        selectedYear = parseInt(sel.value, 10);
        renderGraph2();
        renderTable();
        renderKPIs();
    });
}

// ── Combine toggle ──
function initCombineToggle() {
    const toggle = document.getElementById('combineToggle');
    toggle.checked = combineAgencies;
    toggle.addEventListener('change', () => {
        combineAgencies = toggle.checked;
        renderGraph1();
    });
}

// ── 4. KPIs ────────────────────────────────────────────────────
function renderKPIs() {
    const rows = getFiltered();
    const yearRows = rows.filter(r => r[0] === selectedYear);

    let annual = 0, cumulative = 0;
    const programs   = new Set();
    const recipients = new Set();

    rows.forEach(r => { cumulative += r[8]; });

    yearRows.forEach(r => {
        annual += r[8];
        programs.add(r[3]);   // shortNameIdx
        recipients.add(r[7]); // recipientIdx
    });

    document.getElementById('kpiAnnual').textContent     = fmtDollar(annual);
    document.getElementById('kpiCumulative').textContent = fmtDollar(cumulative);
    document.getElementById('kpiPrograms').textContent   = programs.size.toLocaleString();
    document.getElementById('kpiRecipients').textContent = recipients.size.toLocaleString();
    document.getElementById('kpiYearLabel').textContent  = String(selectedYear);
}

// ── 5. GRAPH 1: Time series ────────────────────────────────────
function renderGraph1() {
    if (c1) c1.destroy();

    const rows   = getFiltered();
    const years  = getUniqueYears();
    let datasets = [];
    let stacked  = false;
    let title    = 'Total Transfer Payments Over Time';

    if (combineAgencies) {
        // Single line / bars: total per year
        const byYear = {};
        years.forEach(y => { byYear[y] = 0; });
        rows.forEach(r => { byYear[r[0]] = (byYear[r[0]] || 0) + r[8]; });

        const label = selDeptIdx === -1
            ? (selAgencyIdx === -1 ? 'All Departments' : db.agencies[selAgencyIdx])
            : db.departments[selDeptIdx];

        datasets.push({
            label,
            data: years.map(y => byYear[y] || 0),
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            barThickness: 28
        });
    } else {
        stacked = true;

        if (selDeptIdx === -1) {
            // Stack by Department
            title = 'Transfer Payments Over Time by Department';
            const byDept = {};
            rows.forEach(r => {
                const d = db.agencyToDeptIndex[r[1]];
                if (!byDept[d]) byDept[d] = {};
                byDept[d][r[0]] = (byDept[d][r[0]] || 0) + r[8];
            });

            const sorted = Object.keys(byDept)
                .map(d => parseInt(d))
                .sort((a, b) => {
                    const sa = Object.values(byDept[a]).reduce((s,v)=>s+v,0);
                    const sb = Object.values(byDept[b]).reduce((s,v)=>s+v,0);
                    return sb - sa;
                });

            sorted.forEach((dIdx, ci) => {
                const total = Object.values(byDept[dIdx]).reduce((s,v)=>s+v,0);
                if (!total) return;
                datasets.push({
                    label: db.departments[dIdx],
                    data: years.map(y => byDept[dIdx][y] || 0),
                    backgroundColor: PALETTE[ci % PALETTE.length],
                    borderRadius: 3
                });
            });
        } else {
            // Stack by Agency within selected dept
            title = `Spend Over Time by Agency — ${db.departments[selDeptIdx]}`;
            const byAgency = {};
            rows.forEach(r => {
                if (!byAgency[r[1]]) byAgency[r[1]] = {};
                byAgency[r[1]][r[0]] = (byAgency[r[1]][r[0]] || 0) + r[8];
            });

            const sorted = Object.keys(byAgency)
                .map(a => parseInt(a))
                .sort((a, b) => {
                    const sa = Object.values(byAgency[a]).reduce((s,v)=>s+v,0);
                    const sb = Object.values(byAgency[b]).reduce((s,v)=>s+v,0);
                    return sb - sa;
                });

            sorted.forEach((aIdx, ci) => {
                const total = Object.values(byAgency[aIdx]).reduce((s,v)=>s+v,0);
                if (!total) return;
                datasets.push({
                    label: db.agencies[aIdx],
                    data: years.map(y => byAgency[aIdx][y] || 0),
                    backgroundColor: PALETTE[ci % PALETTE.length],
                    borderRadius: 3
                });
            });
        }
    }

    document.getElementById('chart1Title').textContent = title;

    c1 = new Chart(document.getElementById('chart1'), {
        type: 'bar',
        data: { labels: years, datasets },
        options: verticalBarOpts(stacked)
    });
}

// ── 6. GRAPH 2: Breakdown for selected year ────────────────────
function renderGraph2() {
    if (c2) c2.destroy();

    const rows     = getFiltered();
    const yearRows = rows.filter(r => r[0] === selectedYear);
    const byGroup  = {};
    let total = 0;

    if (selDeptIdx === -1) {
        // Group by Department
        yearRows.forEach(r => {
            const d = db.agencyToDeptIndex[r[1]];
            byGroup[d] = (byGroup[d] || 0) + r[8];
            total += r[8];
        });
    } else {
        // Group by Agency
        yearRows.forEach(r => {
            byGroup[r[1]] = (byGroup[r[1]] || 0) + r[8];
            total += r[8];
        });
    }

    let sorted = Object.entries(byGroup)
        .map(([k, v]) => ({ idx: parseInt(k), amt: v }))
        .filter(x => x.amt > 0)
        .sort((a, b) => b.amt - a.amt);

    const top = sorted.slice(0, 15);
    const labels = top.map(x => selDeptIdx === -1 ? db.departments[x.idx] : db.agencies[x.idx]);
    const values = top.map(x => x.amt);

    // Other bucket
    const topSum = values.reduce((s, v) => s + v, 0);
    if (sorted.length > 15 && total - topSum > 0) {
        labels.push(selDeptIdx === -1 ? 'Other Departments' : 'Other Agencies');
        values.push(total - topSum);
    }

    const wrapper = document.getElementById('chart2Wrapper');
    wrapper.style.height = Math.max(400, labels.length * 30) + 'px';

    const title = selDeptIdx === -1
        ? `Transfer Payments by Department — ${selectedYear}`
        : `Agency Spending: ${db.departments[selDeptIdx]} — ${selectedYear}`;
    document.getElementById('chart2Title').textContent = title;

    // Gradient colours
    const colors = gradientColors(top.length, '#3b82f6', '#06b6d4');
    if (labels.length > top.length) colors.push('#6b7089');

    c2 = new Chart(document.getElementById('chart2'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Amount ($)',
                data: values,
                backgroundColor: colors,
                borderRadius: 4,
                barThickness: 18
            }]
        },
        options: horizontalBarOpts()
    });
}

// ── 7. TABLE ────────────────────────────────────────────────────
function initTableControls() {
    document.getElementById('tableSearch').addEventListener('input', e => {
        searchQ = e.target.value;
        renderTable();
    });

    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortCol === col) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortCol = col;
                sortDir = (col === 'amount') ? 'desc' : 'asc';
            }
            updateSortIcons();
            renderTable();
        });
    });
}

function updateSortIcons() {
    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortCol) th.classList.add('sort-' + sortDir);
    });
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    updateSortIcons();

    const filtered  = getFiltered();
    const yearRows  = filtered.filter(r => r[0] === selectedYear);
    const agg       = {};
    let totalSum    = 0;

    yearRows.forEach(r => {
        const key = `${r[7]}|${r[3]}|${r[1]}|${r[4]}`;
        if (!agg[key]) {
            agg[key] = { recipIdx: r[7], shortIdx: r[3], progIdx: r[2], agIdx: r[1], locIdx: r[4], amount: 0 };
        }
        agg[key].amount += r[8];
        totalSum += r[8];
    });

    let list = Object.values(agg);
    list.forEach(x => { x.percent = totalSum > 0 ? (x.amount / totalSum) * 100 : 0; });

    // Search
    if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        list = list.filter(x =>
            db.recipients[x.recipIdx].toLowerCase().includes(q) ||
            db.programShortNames[x.shortIdx].toLowerCase().includes(q) ||
            db.agencies[x.agIdx].toLowerCase().includes(q) ||
            db.locations[x.locIdx].toLowerCase().includes(q)
        );
    }

    // Sort
    list.sort((a, b) => {
        let va, vb;
        switch (sortCol) {
            case 'recipient': va = db.recipients[a.recipIdx];        vb = db.recipients[b.recipIdx];        break;
            case 'program':   va = db.programShortNames[a.shortIdx]; vb = db.programShortNames[b.shortIdx]; break;
            case 'agency':    va = db.agencies[a.agIdx];             vb = db.agencies[b.agIdx];             break;
            case 'location':  va = db.locations[a.locIdx];           vb = db.locations[b.locIdx];           break;
            default:          va = a.amount; vb = b.amount;
        }
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? va - vb : vb - va;
    });

    const display = list.slice(0, 100);
    tbody.innerHTML = '';

    if (!display.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No matching records found.</td></tr>`;
        return;
    }

    display.forEach(x => {
        const tr  = document.createElement('tr');
        const prog = db.programShortNames[x.shortIdx];
        const full = db.programs[x.progIdx];
        tr.innerHTML = `
            <td><strong>${db.recipients[x.recipIdx]}</strong></td>
            <td><span class="program-badge" title="${full.replace(/"/g,"&quot;")}">${prog !== 'Unknown' ? prog : full.substring(0,60) + '…'}</span></td>
            <td>${db.agencies[x.agIdx]}</td>
            <td>${db.locations[x.locIdx]}</td>
            <td class="numeric">${fmtDollar(x.amount)}</td>
            <td class="numeric font-mono">${x.percent.toFixed(2)}%</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('tableSubtitle').textContent =
        `Showing ${display.length} of ${list.length.toLocaleString()} recipients · ${selectedYear}`;
}

// ── 8. THEME ────────────────────────────────────────────────────
function initTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    themeMode = localStorage.getItem('td-theme') || 'dark';
    applyTheme(themeMode);

    btn.addEventListener('click', () => {
        themeMode = themeMode === 'dark' ? 'light' : 'dark';
        applyTheme(themeMode);
        localStorage.setItem('td-theme', themeMode);
        renderAll();
    });
}

function applyTheme(mode) {
    const icon = document.querySelector('#themeToggle .theme-icon');
    if (mode === 'light') {
        document.body.classList.add('light-mode');
        if (icon) icon.textContent = '🔆';
    } else {
        document.body.classList.remove('light-mode');
        if (icon) icon.textContent = '🌙';
    }
}

// ── 9. CHART OPTIONS ────────────────────────────────────────────
function verticalBarOpts(stacked) {
    const muted = getThemeVar('--text-muted') || '#6b7089';
    const sec   = getThemeVar('--text-secondary') || '#a0a4b8';
    const card  = getThemeVar('--bg-card') || '#1a1d2e';
    const prim  = getThemeVar('--text-primary') || '#e8eaf0';
    const bdr   = getThemeVar('--border') || '#262a3d';
    const grid  = getThemeVar('--border-light') || '#2d3150';

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: stacked,
                position: 'bottom',
                labels: { color: sec, font: { size: 10, family: 'Inter' }, boxWidth: 12 }
            },
            tooltip: {
                backgroundColor: card, titleColor: prim, bodyColor: sec,
                borderColor: bdr, borderWidth: 1, padding: 12, cornerRadius: 8,
                callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtDollar(ctx.parsed.y)}` }
            }
        },
        scales: {
            y: {
                stacked,
                grid: { color: grid },
                ticks: { color: muted, font: { family: 'Inter', size: 10 }, callback: fmtDollar }
            },
            x: {
                stacked,
                grid: { display: false },
                ticks: { color: muted, font: { family: 'Inter', size: 10 } }
            }
        }
    };
}

function horizontalBarOpts() {
    const muted = getThemeVar('--text-muted') || '#6b7089';
    const sec   = getThemeVar('--text-secondary') || '#a0a4b8';
    const card  = getThemeVar('--bg-card') || '#1a1d2e';
    const prim  = getThemeVar('--text-primary') || '#e8eaf0';
    const bdr   = getThemeVar('--border') || '#262a3d';
    const grid  = getThemeVar('--border-light') || '#2d3150';

    return {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: card, titleColor: prim, bodyColor: sec,
                borderColor: bdr, borderWidth: 1, padding: 12, cornerRadius: 8,
                callbacks: { label: ctx => `Amount: ${fmtDollar(ctx.parsed.x)}` }
            }
        },
        scales: {
            x: {
                grid: { color: grid },
                ticks: { color: muted, font: { family: 'Inter', size: 10 }, callback: fmtDollar }
            },
            y: {
                grid: { display: false },
                ticks: { color: sec, font: { family: 'Inter', size: 10 } }
            }
        }
    };
}

// ── 10. COLOUR HELPERS ──────────────────────────────────────────
function gradientColors(n, from, to) {
    if (n <= 1) return [from];
    const f = hexRgb(from), t = hexRgb(to);
    return Array.from({ length: n }, (_, i) => {
        const p = i / (n - 1);
        return `rgb(${lerp(f.r,t.r,p)},${lerp(f.g,t.g,p)},${lerp(f.b,t.b,p)})`;
    });
}

function hexRgb(hex) {
    const h = hex.replace('#','');
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// ── 11. RENDER ALL ──────────────────────────────────────────────
function renderAll() {
    renderKPIs();
    renderGraph1();
    renderGraph2();
    renderTable();
}

// ── START ───────────────────────────────────────────────────────
init();
