/* ================================================================
   Transfer Detail Dashboard â€” app.js
   Records: [year, agencyIdx, programIdx, shortNameIdx, locationIdx, cityIdx, groupIdx, recipientIdx, amount]
   ================================================================ */

'use strict';

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let db = null;

let selDeptIdx    = -1;   // -1 = <ALL>
let selAgencyIdx  = -1;
let selLocIdx     = -1;
let selectedYear  = null;
let combineAgencies = true;
let themeMode     = 'dark';

let sortCol = 'amount';
let sortDir = 'desc';
let searchQ = '';

let c1 = null;
let c2 = null;

const PALETTE = [
    '#3b82f6','#10b981','#06b6d4','#f59e0b',
    '#ec4899','#8b5cf6','#f97316','#14b8a6',
    '#6366f1','#84cc16','#e11d48','#0ea5e9'
];

// â”€â”€ 1. INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function init() {
    const status = document.getElementById('dataStatus');
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        db = await res.json();
    } catch (e) {
        status.textContent = 'Load failed';
        status.className = 'data-status error';
        console.error(e);
        return;
    }

    selectedYear = getYears().slice(-1)[0];

    status.textContent = db.records.length.toLocaleString() + ' records';
    status.className = 'data-status loaded';

    initTheme();
    wireDropdowns();       // set up triggers ONCE
    fillDeptList();
    fillAgencyList();
    fillLocList();
    buildYearSelect();
    initCombineToggle();
    initTableControls();
    initDropdownDismiss();
    renderAll();
    initRecipientChart();
}

// â”€â”€ 2. HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getYears() {
    return [...new Set(db.records.map(r => r[0]))].sort((a, b) => a - b);
}

function getFiltered() {
    let rows = db.records;
    if (selDeptIdx   !== -1) rows = rows.filter(r => db.agencyToDeptIndex[r[1]] === selDeptIdx);
    if (selAgencyIdx !== -1) rows = rows.filter(r => r[1] === selAgencyIdx);
    if (selLocIdx    !== -1) rows = rows.filter(r => r[4] === selLocIdx);
    return rows;
}

function fmt(v) {
    if (!v) return '$0';
    const neg = v < 0, a = Math.abs(v);
    const s = a >= 1e9 ? '$' + (a/1e9).toFixed(2) + 'B'
            : a >= 1e6 ? '$' + (a/1e6).toFixed(2) + 'M'
            : '$' + a.toLocaleString('en-CA', {maximumFractionDigits:0});
    return neg ? '-'+s : s;
}

function cssVar(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

// â”€â”€ 3. DROPDOWN WIRING (called once) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Each dropdown: trigger opens/closes menu; click outside closes all.
function wireDropdowns() {
    const dds = [
        { trigger: 'deptTrigger',   menu: 'deptMenu'   },
        { trigger: 'agencyTrigger', menu: 'agencyMenu' },
        { trigger: 'locTrigger',    menu: 'locMenu'    }
    ];

    dds.forEach(dd => {
        const trigger = document.getElementById(dd.trigger);
        const wrapper = trigger.closest('.custom-dropdown');

        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');
            closeAll();
            if (!isOpen) wrapper.classList.add('open');
        });
    });

    // Search boxes â€“ one-time wire (lists are repopulated but search still works)
    wireSearch('deptSearch',   'deptList');
    wireSearch('agencySearch', 'agencyList');
    wireSearch('locSearch',    'locList');

    document.addEventListener('click', closeAll);
}

function closeAll() {
    document.querySelectorAll('.custom-dropdown.open').forEach(el =>
        el.classList.remove('open')
    );
}

function wireSearch(searchId, listId) {
    document.getElementById(searchId).addEventListener('input', function() {
        const q = this.value.toLowerCase();
        document.getElementById(listId).querySelectorAll('.dd-item').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

// â”€â”€ 4. FILL DROPDOWN LISTS (called on each state change) â”€â”€â”€â”€â”€â”€â”€
function setLabel(triggerId, text) {
    document.querySelector('#' + triggerId + ' .dropdown-label').textContent = text;
}

function fillList(listId, items, selectedIdx, onSelect) {
    // items: [{idx, name}]
    const list = document.getElementById(listId);
    list.innerHTML = '';

    const allRow = makeItem('<ALL>', selectedIdx === -1, () => {
        onSelect(-1, '<ALL>');
        closeAll();
    });
    list.appendChild(allRow);

    items.forEach(item => {
        const el = makeItem(item.name, item.idx === selectedIdx, () => {
            onSelect(item.idx, item.name);
            closeAll();
        });
        list.appendChild(el);
    });
}

function makeItem(text, selected, onClick) {
    const div = document.createElement('div');
    div.className = 'dd-item' + (selected ? ' selected' : '');
    div.textContent = text;
    div.addEventListener('click', function(e) {
        e.stopPropagation();
        onClick();
    });
    return div;
}

function fillDeptList() {
    const items = db.departments
        .map((name, idx) => ({idx, name}))
        .sort((a, b) => a.name.localeCompare(b.name));

    fillList('deptList', items, selDeptIdx, (idx, name) => {
        selDeptIdx   = idx;
        selAgencyIdx = -1;
        setLabel('deptTrigger',   name);
        setLabel('agencyTrigger', '<ALL>');
        fillAgencyList();
        renderAll();
    });
}

function fillAgencyList() {
    let items = db.agencies.map((name, idx) => ({idx, name}));
    if (selDeptIdx !== -1) {
        items = items.filter(item => db.agencyToDeptIndex[item.idx] === selDeptIdx);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));

    fillList('agencyList', items, selAgencyIdx, (idx, name) => {
        selAgencyIdx = idx;
        setLabel('agencyTrigger', name);
        renderAll();
    });
}

function fillLocList() {
    const items = db.locations
        .map((name, idx) => ({idx, name}))
        .sort((a, b) => a.name.localeCompare(b.name));

    fillList('locList', items, selLocIdx, (idx, name) => {
        selLocIdx = idx;
        setLabel('locTrigger', name);
        renderAll();
    });
}

// â”€â”€ 5. YEAR SELECT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildYearSelect() {
    const sel = document.getElementById('yearSelect');
    sel.innerHTML = '';
    getYears().slice().reverse().forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === selectedYear) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', function() {
        selectedYear = parseInt(this.value, 10);
        renderKPIs();
        renderGraph2();
        renderTable();
    });
}

// â”€â”€ 6. COMBINE TOGGLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initCombineToggle() {
    const toggle = document.getElementById('combineToggle');
    toggle.checked = combineAgencies;
    toggle.addEventListener('change', function() {
        combineAgencies = this.checked;
        renderGraph1();
    });
}

// â”€â”€ 7. KPIs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderKPIs() {
    const rows     = getFiltered();
    const yearRows = rows.filter(r => r[0] === selectedYear);

    let annual = 0, cumulative = 0;
    const programs   = new Set();
    const recipients = new Set();

    rows.forEach(r => { cumulative += r[8]; });
    yearRows.forEach(r => {
        annual += r[8];
        programs.add(r[3]);
        recipients.add(r[7]);
    });

    document.getElementById('kpiAnnual').textContent     = fmt(annual);
    document.getElementById('kpiCumulative').textContent = fmt(cumulative);
    document.getElementById('kpiPrograms').textContent   = programs.size.toLocaleString();
    document.getElementById('kpiRecipients').textContent = recipients.size.toLocaleString();
    document.getElementById('kpiYearLabel').textContent  = String(selectedYear);
}

// â”€â”€ 8. CHART 1: Time series â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderGraph1() {
    if (c1) c1.destroy();

    const rows  = getFiltered();
    const years = getYears();
    let datasets = [], stacked = false;
    let title = 'Total Transfer Payments Over Time';

    if (combineAgencies) {
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
            title = 'Transfer Payments Over Time by Department';
            const byDept = {};
            rows.forEach(r => {
                const d = db.agencyToDeptIndex[r[1]];
                if (!byDept[d]) byDept[d] = {};
                byDept[d][r[0]] = (byDept[d][r[0]] || 0) + r[8];
            });

            Object.keys(byDept)
                .map(Number)
                .sort((a, b) => {
                    const sa = Object.values(byDept[a]).reduce((s,v)=>s+v,0);
                    const sb = Object.values(byDept[b]).reduce((s,v)=>s+v,0);
                    return sb - sa;
                })
                .forEach((dIdx, ci) => {
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
            title = 'Spend Over Time by Agency â€” ' + db.departments[selDeptIdx];
            const byAg = {};
            rows.forEach(r => {
                if (!byAg[r[1]]) byAg[r[1]] = {};
                byAg[r[1]][r[0]] = (byAg[r[1]][r[0]] || 0) + r[8];
            });

            Object.keys(byAg)
                .map(Number)
                .sort((a, b) => {
                    const sa = Object.values(byAg[a]).reduce((s,v)=>s+v,0);
                    const sb = Object.values(byAg[b]).reduce((s,v)=>s+v,0);
                    return sb - sa;
                })
                .forEach((aIdx, ci) => {
                    const total = Object.values(byAg[aIdx]).reduce((s,v)=>s+v,0);
                    if (!total) return;
                    datasets.push({
                        label: db.agencies[aIdx],
                        data: years.map(y => byAg[aIdx][y] || 0),
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
        options: vBarOpts(stacked)
    });
}

// â”€â”€ 9. CHART 2: Year breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderGraph2() {
    if (c2) c2.destroy();

    const yearRows = getFiltered().filter(r => r[0] === selectedYear);
    const byGroup  = {};
    let total = 0;

    if (selDeptIdx === -1) {
        yearRows.forEach(r => {
            const d = db.agencyToDeptIndex[r[1]];
            byGroup[d] = (byGroup[d] || 0) + r[8];
            total += r[8];
        });
    } else {
        yearRows.forEach(r => {
            byGroup[r[1]] = (byGroup[r[1]] || 0) + r[8];
            total += r[8];
        });
    }

    const sorted = Object.entries(byGroup)
        .map(([k, v]) => ({ idx: +k, amt: v }))
        .filter(x => x.amt > 0)
        .sort((a, b) => b.amt - a.amt);

    const top    = sorted.slice(0, 15);
    const labels = top.map(x => selDeptIdx === -1 ? db.departments[x.idx] : db.agencies[x.idx]);
    const values = top.map(x => x.amt);

    const topSum = values.reduce((s,v) => s+v, 0);
    if (sorted.length > 15 && total - topSum > 0) {
        labels.push(selDeptIdx === -1 ? 'Other Departments' : 'Other Agencies');
        values.push(total - topSum);
    }

    const wrapper = document.getElementById('chart2Wrapper');
    wrapper.style.height = Math.max(400, labels.length * 30) + 'px';

    const title = selDeptIdx === -1
        ? 'Transfer Payments by Department â€” ' + selectedYear
        : 'Agency Spending: ' + db.departments[selDeptIdx] + ' â€” ' + selectedYear;
    document.getElementById('chart2Title').textContent = title;

    const colors = gradColors(top.length, '#3b82f6', '#06b6d4');
    if (labels.length > top.length) colors.push('#6b7089');

    c2 = new Chart(document.getElementById('chart2'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Amount',
                data: values,
                backgroundColor: colors,
                borderRadius: 4,
                barThickness: 18
            }]
        },
        options: hBarOpts()
    });
}

// â”€â”€ 10. TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initTableControls() {
    document.getElementById('tableSearch').addEventListener('input', function() {
        searchQ = this.value;
        renderTable();
    });

    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const col = this.dataset.sort;
            if (sortCol === col) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortCol = col;
                sortDir = col === 'amount' ? 'desc' : 'asc';
            }
            updateSortIcons();
            renderTable();
        });
    });
}

function updateSortIcons() {
    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc','sort-desc');
        if (th.dataset.sort === sortCol) th.classList.add('sort-' + sortDir);
    });
}

function renderTable() {
    const tbody    = document.getElementById('tableBody');
    if (!tbody) return;
    updateSortIcons();

    const yearRows = getFiltered().filter(r => r[0] === selectedYear);
    const agg      = {};
    let totalSum   = 0;

    yearRows.forEach(r => {
        const key = r[7] + '|' + r[3] + '|' + r[1] + '|' + r[4];
        if (!agg[key]) {
            agg[key] = { recipIdx: r[7], shortIdx: r[3], progIdx: r[2], agIdx: r[1], locIdx: r[4], amount: 0 };
        }
        agg[key].amount += r[8];
        totalSum += r[8];
    });

    let list = Object.values(agg);
    list.forEach(x => { x.percent = totalSum > 0 ? (x.amount / totalSum) * 100 : 0; });

    if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        list = list.filter(x =>
            db.recipients[x.recipIdx].toLowerCase().includes(q) ||
            db.programShortNames[x.shortIdx].toLowerCase().includes(q) ||
            db.agencies[x.agIdx].toLowerCase().includes(q) ||
            db.locations[x.locIdx].toLowerCase().includes(q)
        );
    }

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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">No matching records found.</td></tr>';
        return;
    }

    display.forEach(x => {
        const tr   = document.createElement('tr');
        const prog = db.programShortNames[x.shortIdx];
        const full = db.programs[x.progIdx];
        const label = (prog && prog !== 'Unknown') ? prog : (full ? full.substring(0,60) + '...' : 'â€”');
        const tip   = full ? full.replace(/"/g, '&quot;') : '';

        tr.innerHTML =
            '<td><strong>' + db.recipients[x.recipIdx] + '</strong></td>' +
            '<td><span class="program-badge" title="' + tip + '">' + label + '</span></td>' +
            '<td>' + db.agencies[x.agIdx] + '</td>' +
            '<td>' + db.locations[x.locIdx] + '</td>' +
            '<td class="numeric">' + fmt(x.amount) + '</td>' +
            '<td class="numeric font-mono">' + x.percent.toFixed(2) + '%</td>';
        tbody.appendChild(tr);
    });

    document.getElementById('tableSubtitle').textContent =
        'Showing ' + display.length + ' of ' + list.length.toLocaleString() + ' recipients \u00b7 ' + selectedYear;
}

// â”€â”€ 11. THEME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    themeMode = localStorage.getItem('td-theme') || 'dark';
    applyTheme(themeMode);
    btn.addEventListener('click', function() {
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
        if (icon) icon.textContent = '\u{1F506}';
    } else {
        document.body.classList.remove('light-mode');
        if (icon) icon.textContent = '\u{1F319}';
    }
}

// â”€â”€ 12. CHART OPTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function vBarOpts(stacked) {
    const muted = cssVar('--text-muted') || '#6b7089';
    const sec   = cssVar('--text-secondary') || '#a0a4b8';
    const card  = cssVar('--bg-card') || '#1a1d2e';
    const prim  = cssVar('--text-primary') || '#e8eaf0';
    const bdr   = cssVar('--border') || '#262a3d';
    const grid  = cssVar('--border-light') || '#2d3150';
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: {
                display: stacked, position: 'bottom',
                labels: { color: sec, font: { size: 10, family: 'Inter' }, boxWidth: 12 }
            },
            tooltip: {
                backgroundColor: card, titleColor: prim, bodyColor: sec,
                borderColor: bdr, borderWidth: 1, padding: 12, cornerRadius: 8,
                callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.parsed.y) }
            }
        },
        scales: {
            y: { stacked, grid: { color: grid },
                 ticks: { color: muted, font: { family:'Inter', size:10 }, callback: fmt } },
            x: { stacked, grid: { display: false },
                 ticks: { color: muted, font: { family:'Inter', size:10 } } }
        }
    };
}

function hBarOpts() {
    const muted = cssVar('--text-muted') || '#6b7089';
    const sec   = cssVar('--text-secondary') || '#a0a4b8';
    const card  = cssVar('--bg-card') || '#1a1d2e';
    const prim  = cssVar('--text-primary') || '#e8eaf0';
    const bdr   = cssVar('--border') || '#262a3d';
    const grid  = cssVar('--border-light') || '#2d3150';
    return {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: card, titleColor: prim, bodyColor: sec,
                borderColor: bdr, borderWidth: 1, padding: 12, cornerRadius: 8,
                callbacks: { label: ctx => 'Amount: ' + fmt(ctx.parsed.x) }
            }
        },
        scales: {
            x: { grid: { color: grid },
                 ticks: { color: muted, font: { family:'Inter', size:10 }, callback: fmt } },
            y: { grid: { display: false },
                 ticks: { color: sec, font: { family:'Inter', size:10 } } }
        }
    };
}

// â”€â”€ 13. COLOURS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function gradColors(n, from, to) {
    if (n <= 1) return [from];
    const f = hexRgb(from), t = hexRgb(to);
    return Array.from({length: n}, (_, i) => {
        const p = i / (n - 1);
        return 'rgb(' + lerp(f.r,t.r,p) + ',' + lerp(f.g,t.g,p) + ',' + lerp(f.b,t.b,p) + ')';
    });
}
function hexRgb(hex) {
    const h = hex.replace('#','');
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}
function lerp(a, b, t) { return Math.round(a + (b-a)*t); }

// â”€â”€ 14. RENDER ALL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderAll() {
    renderKPIs();
    renderGraph1();
    renderGraph2();
    renderTable();
}

// â”€â”€ GO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
init();
