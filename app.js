/* ================================================================
   Transfer Detail Dashboard - app.js
   Records: [year, agencyIdx, programIdx, shortNameIdx, locationIdx,
             cityIdx, groupIdx, recipientIdx, amount]
   ================================================================ */
'use strict';

// ── State ──────────────────────────────────────────────────────
let db = null;

let selDeptIdx    = -1;
let selAgencyIdx  = -1;
let selLocIdx     = -1;
let selectedYear  = null;
let combineAgencies = false;   // default: OFF
let themeMode       = 'light'; // default: day mode

// Table
let sortCol = 'amount';
let sortDir = 'desc';
let colFilters = { recipient: '', program: '', agency: '', location: '' };
let selectedRecipientSet = new Set(); // set of recipientIdx integers

// Recipient chart
let recipientCombine = false;

// Charts
let c1 = null, c2 = null, c3 = null;

const PALETTE = [
    '#3b82f6','#10b981','#06b6d4','#f59e0b',
    '#ec4899','#8b5cf6','#f97316','#14b8a6',
    '#6366f1','#84cc16','#e11d48','#0ea5e9'
];

const CHIP_COLORS = [
    { border:'#3b82f6', bg:'rgba(59,130,246,.15)'  },
    { border:'#10b981', bg:'rgba(16,185,129,.15)'  },
    { border:'#f59e0b', bg:'rgba(245,158,11,.15)'  },
    { border:'#ec4899', bg:'rgba(236,72,153,.15)'  },
    { border:'#8b5cf6', bg:'rgba(139,92,246,.15)'  },
    { border:'#f97316', bg:'rgba(249,115,22,.15)'  },
    { border:'#06b6d4', bg:'rgba(6,182,212,.15)'   },
    { border:'#84cc16', bg:'rgba(132,204,22,.15)'  }
];

// ── 1. INIT ────────────────────────────────────────────────────
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
    wireDropdowns();
    fillDeptList();
    fillAgencyList();
    fillLocList();
    buildYearSelect();
    initCombineToggle();
    initTableControls();
    initDropdownDismiss();
    initRecipientToggle();
    renderAll();
    renderRecipientChart();
}

// ── 2. HELPERS ─────────────────────────────────────────────────
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

// ── 3. DROPDOWNS ───────────────────────────────────────────────
function wireDropdowns() {
    [
        { trigger: 'deptTrigger',   menu: 'deptMenu'   },
        { trigger: 'agencyTrigger', menu: 'agencyMenu' },
        { trigger: 'locTrigger',    menu: 'locMenu'    }
    ].forEach(dd => {
        const trigger = document.getElementById(dd.trigger);
        const wrapper = trigger.closest('.custom-dropdown');
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = wrapper.classList.contains('open');
            closeAll();
            if (!isOpen) wrapper.classList.add('open');
        });
    });

    wireSearch('deptSearch',   'deptList');
    wireSearch('agencySearch', 'agencyList');
    wireSearch('locSearch',    'locList');

    document.addEventListener('click', closeAll);
}

function closeAll() {
    document.querySelectorAll('.custom-dropdown.open').forEach(el => el.classList.remove('open'));
}

function wireSearch(searchId, listId) {
    document.getElementById(searchId).addEventListener('input', function() {
        const q = this.value.toLowerCase();
        document.getElementById(listId).querySelectorAll('.dd-item').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

function initDropdownDismiss() { /* wired via document.addEventListener in wireDropdowns */ }

// ── 4. FILL LISTS ──────────────────────────────────────────────
function setLabel(triggerId, text) {
    document.querySelector('#' + triggerId + ' .dropdown-label').textContent = text;
}

function fillList(listId, items, selectedIdx, onSelect) {
    const list = document.getElementById(listId);
    list.innerHTML = '';
    list.appendChild(makeItem('<ALL>', selectedIdx === -1, () => { onSelect(-1, '<ALL>'); closeAll(); }));
    items.forEach(item => {
        list.appendChild(makeItem(item.name, item.idx === selectedIdx, () => { onSelect(item.idx, item.name); closeAll(); }));
    });
}

function makeItem(text, selected, onClick) {
    const div = document.createElement('div');
    div.className = 'dd-item' + (selected ? ' selected' : '');
    div.textContent = text;
    div.addEventListener('click', function(e) { e.stopPropagation(); onClick(); });
    return div;
}

function fillDeptList() {
    const items = db.departments.map((n,i) => ({idx:i,name:n})).sort((a,b) => a.name.localeCompare(b.name));
    fillList('deptList', items, selDeptIdx, (idx, name) => {
        selDeptIdx = idx; selAgencyIdx = -1;
        setLabel('deptTrigger', name);
        setLabel('agencyTrigger', '<ALL>');
        fillAgencyList();
        renderAll();
    });
}

function fillAgencyList() {
    let items = db.agencies.map((n,i) => ({idx:i,name:n}));
    if (selDeptIdx !== -1) items = items.filter(x => db.agencyToDeptIndex[x.idx] === selDeptIdx);
    items.sort((a,b) => a.name.localeCompare(b.name));
    fillList('agencyList', items, selAgencyIdx, (idx, name) => {
        selAgencyIdx = idx;
        setLabel('agencyTrigger', name);
        renderAll();
    });
}

function fillLocList() {
    const items = db.locations.map((n,i) => ({idx:i,name:n})).sort((a,b) => a.name.localeCompare(b.name));
    fillList('locList', items, selLocIdx, (idx, name) => {
        selLocIdx = idx;
        setLabel('locTrigger', name);
        renderAll();
    });
}

// ── 5. YEAR SELECT ─────────────────────────────────────────────
function buildYearSelect() {
    const sel = document.getElementById('yearSelect');
    sel.innerHTML = '';
    getYears().slice().reverse().forEach(y => {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        if (y === selectedYear) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', function() {
        selectedYear = parseInt(this.value, 10);
        renderKPIs(); renderGraph2(); renderTable();
    });
}

// ── 6. COMBINE TOGGLE ──────────────────────────────────────────
function initCombineToggle() {
    const toggle = document.getElementById('combineToggle');
    toggle.checked = combineAgencies;
    toggle.addEventListener('change', function() {
        combineAgencies = this.checked;
        renderGraph1();
    });
}

// ── 7. RECIPIENT CHART TOGGLE ──────────────────────────────────
function initRecipientToggle() {
    const toggle = document.getElementById('recipientCombine');
    if (!toggle) return;
    toggle.checked = recipientCombine;
    toggle.addEventListener('change', function() {
        recipientCombine = this.checked;
        renderRecipientChart();
    });
}

// ── 8. KPIs ────────────────────────────────────────────────────
function renderKPIs() {
    const rows     = getFiltered();
    const yearRows = rows.filter(r => r[0] === selectedYear);
    let annual = 0, cumulative = 0;
    const programs = new Set(), recipients = new Set();
    rows.forEach(r => { cumulative += r[8]; });
    yearRows.forEach(r => { annual += r[8]; programs.add(r[3]); recipients.add(r[7]); });
    document.getElementById('kpiAnnual').textContent     = fmt(annual);
    document.getElementById('kpiCumulative').textContent = fmt(cumulative);
    document.getElementById('kpiPrograms').textContent   = programs.size.toLocaleString();
    document.getElementById('kpiRecipients').textContent = recipients.size.toLocaleString();
    document.getElementById('kpiYearLabel').textContent  = String(selectedYear);
}

// ── 9. CHART 1: Time series ────────────────────────────────────
function renderGraph1() {
    if (c1) c1.destroy();
    const rows = getFiltered(), years = getYears();
    let datasets = [], stacked = false;
    let title = 'Total Transfer Payments Over Time';

    if (combineAgencies) {
        const byYear = {};
        years.forEach(y => { byYear[y] = 0; });
        rows.forEach(r => { byYear[r[0]] = (byYear[r[0]] || 0) + r[8]; });
        const label = selDeptIdx === -1 ? (selAgencyIdx === -1 ? 'All Departments' : db.agencies[selAgencyIdx]) : db.departments[selDeptIdx];
        datasets.push({ label, data: years.map(y => byYear[y] || 0), backgroundColor: '#3b82f6', borderRadius: 4, barThickness: 28 });
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
            Object.keys(byDept).map(Number)
                .sort((a,b) => Object.values(byDept[b]).reduce((s,v)=>s+v,0) - Object.values(byDept[a]).reduce((s,v)=>s+v,0))
                .forEach((dIdx, ci) => {
                    const total = Object.values(byDept[dIdx]).reduce((s,v)=>s+v,0);
                    if (!total) return;
                    datasets.push({ label: db.departments[dIdx], data: years.map(y => byDept[dIdx][y] || 0), backgroundColor: PALETTE[ci % PALETTE.length], borderRadius: 3 });
                });
        } else {
            title = 'Spend Over Time by Agency \u2014 ' + db.departments[selDeptIdx];
            const byAg = {};
            rows.forEach(r => {
                if (!byAg[r[1]]) byAg[r[1]] = {};
                byAg[r[1]][r[0]] = (byAg[r[1]][r[0]] || 0) + r[8];
            });
            Object.keys(byAg).map(Number)
                .sort((a,b) => Object.values(byAg[b]).reduce((s,v)=>s+v,0) - Object.values(byAg[a]).reduce((s,v)=>s+v,0))
                .forEach((aIdx, ci) => {
                    const total = Object.values(byAg[aIdx]).reduce((s,v)=>s+v,0);
                    if (!total) return;
                    datasets.push({ label: db.agencies[aIdx], data: years.map(y => byAg[aIdx][y] || 0), backgroundColor: PALETTE[ci % PALETTE.length], borderRadius: 3 });
                });
        }
    }

    document.getElementById('chart1Title').textContent = title;
    c1 = new Chart(document.getElementById('chart1'), { type: 'bar', data: { labels: years, datasets }, options: vBarOpts(stacked) });
}

// ── 10. CHART 2: Year breakdown ────────────────────────────────
function renderGraph2() {
    if (c2) c2.destroy();
    const yearRows = getFiltered().filter(r => r[0] === selectedYear);
    const byGroup = {}; let total = 0;
    if (selDeptIdx === -1) {
        yearRows.forEach(r => { const d = db.agencyToDeptIndex[r[1]]; byGroup[d] = (byGroup[d]||0) + r[8]; total += r[8]; });
    } else {
        yearRows.forEach(r => { byGroup[r[1]] = (byGroup[r[1]]||0) + r[8]; total += r[8]; });
    }
    const sorted = Object.entries(byGroup).map(([k,v]) => ({idx:+k, amt:v})).filter(x=>x.amt>0).sort((a,b)=>b.amt-a.amt);
    const top = sorted.slice(0,15);
    const labels = top.map(x => selDeptIdx===-1 ? db.departments[x.idx] : db.agencies[x.idx]);
    const values = top.map(x => x.amt);
    const topSum = values.reduce((s,v)=>s+v,0);
    if (sorted.length > 15 && total - topSum > 0) {
        labels.push(selDeptIdx===-1 ? 'Other Departments' : 'Other Agencies');
        values.push(total - topSum);
    }
    document.getElementById('chart2Wrapper').style.height = Math.max(400, labels.length * 30) + 'px';
    const title = selDeptIdx === -1
        ? 'Transfer Payments by Department \u2014 ' + selectedYear
        : 'Agency Spending: ' + db.departments[selDeptIdx] + ' \u2014 ' + selectedYear;
    document.getElementById('chart2Title').textContent = title;
    const colors = gradColors(top.length, '#3b82f6', '#06b6d4');
    if (labels.length > top.length) colors.push('#6b7089');
    c2 = new Chart(document.getElementById('chart2'), {
        type: 'bar',
        data: { labels, datasets: [{ label:'Amount', data:values, backgroundColor:colors, borderRadius:4, barThickness:18 }] },
        options: hBarOpts()
    });
}

// ── 11. TABLE ──────────────────────────────────────────────────
function initTableControls() {
    // Sort headers
    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const col = this.dataset.sort;
            if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
            else { sortCol = col; sortDir = col === 'amount' ? 'desc' : 'asc'; }
            updateSortIcons();
            renderTable();
        });
    });

    // Column filter inputs
    ['recipient','program','agency','location'].forEach(col => {
        const inp = document.getElementById('filter_' + col);
        if (!inp) return;
        inp.addEventListener('input', function() {
            colFilters[col] = this.value.toLowerCase();
            renderTable();
        });
        // Prevent sort from firing when clicking in the filter input
        inp.addEventListener('click', e => e.stopPropagation());
    });

    // Select-all checkbox
    const selAll = document.getElementById('selectAllCheck');
    if (selAll) {
        selAll.addEventListener('change', function() {
            // Select or deselect all currently visible rows
            const rows = document.querySelectorAll('#tableBody tr[data-recidx]');
            rows.forEach(tr => {
                const idx = parseInt(tr.dataset.recidx);
                const cb  = tr.querySelector('.row-check');
                if (this.checked) { selectedRecipientSet.add(idx); if(cb) cb.checked = true; }
                else              { selectedRecipientSet.delete(idx); if(cb) cb.checked = false; }
            });
            updateSelectionCount();
            renderRecipientChart();
        });
    }

    // Clear all button
    const clearBtn = document.getElementById('tableClearAll');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Clear column filters
            ['recipient','program','agency','location'].forEach(col => {
                colFilters[col] = '';
                const inp = document.getElementById('filter_' + col);
                if (inp) inp.value = '';
            });
            // Clear selections
            selectedRecipientSet.clear();
            const selAll = document.getElementById('selectAllCheck');
            if (selAll) selAll.checked = false;
            updateSelectionCount();
            renderTable();
            renderRecipientChart();
        });
    }
}

function updateSortIcons() {
    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc','sort-desc');
        if (th.dataset.sort === sortCol) th.classList.add('sort-' + sortDir);
    });
}

function updateSelectionCount() {
    const el = document.getElementById('selectionCount');
    if (!el) return;
    const n = selectedRecipientSet.size;
    el.textContent = n > 0 ? n + ' selected' : '';
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    updateSortIcons();

    const yearRows = getFiltered().filter(r => r[0] === selectedYear);
    const agg = {}; let totalSum = 0;
    yearRows.forEach(r => {
        const key = r[7] + '|' + r[3] + '|' + r[1] + '|' + r[4];
        if (!agg[key]) agg[key] = { recipIdx:r[7], shortIdx:r[3], progIdx:r[2], agIdx:r[1], locIdx:r[4], amount:0 };
        agg[key].amount += r[8]; totalSum += r[8];
    });

    let list = Object.values(agg);
    list.forEach(x => { x.percent = totalSum > 0 ? (x.amount/totalSum)*100 : 0; });

    // Apply column filters
    if (colFilters.recipient) list = list.filter(x => db.recipients[x.recipIdx].toLowerCase().includes(colFilters.recipient));
    if (colFilters.program)   list = list.filter(x => db.programShortNames[x.shortIdx].toLowerCase().includes(colFilters.program));
    if (colFilters.agency)    list = list.filter(x => db.agencies[x.agIdx].toLowerCase().includes(colFilters.agency));
    if (colFilters.location)  list = list.filter(x => db.locations[x.locIdx].toLowerCase().includes(colFilters.location));

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

    const display = list.slice(0, 200);
    tbody.innerHTML = '';

    if (!display.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">No matching records. Try clearing filters.</td></tr>';
        document.getElementById('tableSubtitle').textContent = 'No records match current filters';
        return;
    }

    display.forEach(x => {
        const tr  = document.createElement('tr');
        tr.dataset.recidx = x.recipIdx;
        const isChecked = selectedRecipientSet.has(x.recipIdx);
        if (isChecked) tr.classList.add('row-selected');
        const prog  = db.programShortNames[x.shortIdx];
        const full  = db.programs[x.progIdx];
        const label = (prog && prog !== 'Unknown') ? prog : (full ? full.substring(0,60) + '...' : '\u2014');
        const tip   = full ? full.replace(/"/g, '&quot;') : '';

        tr.innerHTML =
            '<td class="check-col"><input type="checkbox" class="row-check"' + (isChecked?' checked':'') + '></td>' +
            '<td><strong>' + escHtml(db.recipients[x.recipIdx]) + '</strong></td>' +
            '<td><span class="program-badge" title="' + tip + '">' + escHtml(label) + '</span></td>' +
            '<td>' + escHtml(db.agencies[x.agIdx]) + '</td>' +
            '<td>' + escHtml(db.locations[x.locIdx]) + '</td>' +
            '<td class="numeric">' + fmt(x.amount) + '</td>' +
            '<td class="numeric font-mono">' + x.percent.toFixed(2) + '%</td>';

        // Checkbox handler
        const cb = tr.querySelector('.row-check');
        cb.addEventListener('change', function(e) {
            e.stopPropagation();
            if (this.checked) { selectedRecipientSet.add(x.recipIdx); tr.classList.add('row-selected'); }
            else              { selectedRecipientSet.delete(x.recipIdx); tr.classList.remove('row-selected'); }
            updateSelectionCount();
            renderRecipientChart();
        });

        // Row click also toggles
        tr.addEventListener('click', function(e) {
            if (e.target.classList.contains('row-check')) return;
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });

        tbody.appendChild(tr);
    });

    document.getElementById('tableSubtitle').textContent =
        'Showing ' + display.length + ' of ' + list.length.toLocaleString() + ' recipients \u00b7 ' + selectedYear;
    updateSelectionCount();
}

function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 12. RECIPIENT CHART (fed from table selections) ────────────
function renderRecipientChart() {
    if (c3) { c3.destroy(); c3 = null; }

    const wrap  = document.getElementById('recipientChartWrap');
    const sub   = document.getElementById('recipientSubtitle');
    const years = getYears();

    if (selectedRecipientSet.size === 0) {
        wrap.innerHTML = '<div class="chart-placeholder">Check recipients in the table above to chart their spending over time</div>';
        if (sub) sub.textContent = 'Select recipients in the table above';
        return;
    }

    if (!document.getElementById('chart3')) {
        wrap.innerHTML = '<canvas id="chart3"></canvas>';
    }

    const selected = [...selectedRecipientSet].map(idx => ({ idx, name: db.recipients[idx] }));
    const datasets = [];

    if (recipientCombine) {
        const byYear = {}; years.forEach(y => { byYear[y] = 0; });
        selected.forEach(r => { db.records.forEach(rec => { if (rec[7] === r.idx) byYear[rec[0]] = (byYear[rec[0]]||0) + rec[8]; }); });
        const col = CHIP_COLORS[0];
        datasets.push({
            label: selected.length === 1 ? selected[0].name : selected.length + ' Recipients Combined',
            data: years.map(y => byYear[y] || 0),
            borderColor: col.border, backgroundColor: col.bg,
            fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5
        });
    } else {
        selected.forEach((r, i) => {
            const byYear = {}; years.forEach(y => { byYear[y] = 0; });
            db.records.forEach(rec => { if (rec[7] === r.idx) byYear[rec[0]] = (byYear[rec[0]]||0) + rec[8]; });
            const col = CHIP_COLORS[i % CHIP_COLORS.length];
            datasets.push({
                label: r.name,
                data: years.map(y => byYear[y] || 0),
                borderColor: col.border, backgroundColor: col.bg,
                fill: false, tension: 0.3, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5
            });
        });
    }

    const muted = cssVar('--text-muted')     || '#6b7089';
    const sec   = cssVar('--text-secondary') || '#a0a4b8';
    const card  = cssVar('--bg-card')        || '#1a1d2e';
    const prim  = cssVar('--text-primary')   || '#e8eaf0';
    const bdr   = cssVar('--border')         || '#262a3d';
    const grid  = cssVar('--border-light')   || '#2d3150';

    c3 = new Chart(document.getElementById('chart3'), {
        type: 'line',
        data: { labels: years, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: datasets.length > 1, position: 'bottom',
                    labels: { color: sec, font: { size: 10, family: 'Inter' }, boxWidth: 14, padding: 16 }
                },
                tooltip: {
                    backgroundColor: card, titleColor: prim, bodyColor: sec,
                    borderColor: bdr, borderWidth: 1, padding: 12, cornerRadius: 8,
                    callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.parsed.y) }
                }
            },
            scales: {
                y: { grid: { color: grid }, ticks: { color: muted, font: { family:'Inter', size:10 }, callback: fmt } },
                x: { grid: { display:false }, ticks: { color: muted, font: { family:'Inter', size:10 } } }
            }
        }
    });

    const label = selected.length === 1 ? selected[0].name : selected.length + ' recipients';
    if (sub) sub.textContent = label + (recipientCombine ? ' \u00b7 Combined' : ' \u00b7 Separate lines');
}

// ── 13. THEME ──────────────────────────────────────────────────
function initTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    themeMode = localStorage.getItem('td-theme') || 'light'; // default: day mode
    applyTheme(themeMode);
    btn.addEventListener('click', function() {
        themeMode = themeMode === 'dark' ? 'light' : 'dark';
        applyTheme(themeMode);
        localStorage.setItem('td-theme', themeMode);
        renderAll();
        renderRecipientChart();
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

// ── 14. CHART OPTIONS ──────────────────────────────────────────
function vBarOpts(stacked) {
    const muted = cssVar('--text-muted')||'#6b7089', sec=cssVar('--text-secondary')||'#a0a4b8';
    const card=cssVar('--bg-card')||'#1a1d2e', prim=cssVar('--text-primary')||'#e8eaf0';
    const bdr=cssVar('--border')||'#262a3d', grid=cssVar('--border-light')||'#2d3150';
    return {
        responsive:true, maintainAspectRatio:false,
        plugins: {
            legend: { display:stacked, position:'bottom', labels:{color:sec,font:{size:10,family:'Inter'},boxWidth:12} },
            tooltip: { backgroundColor:card, titleColor:prim, bodyColor:sec, borderColor:bdr, borderWidth:1, padding:12, cornerRadius:8,
                callbacks:{ label: ctx => ctx.dataset.label+': '+fmt(ctx.parsed.y) } }
        },
        scales: {
            y: { stacked, grid:{color:grid}, ticks:{color:muted,font:{family:'Inter',size:10},callback:fmt} },
            x: { stacked, grid:{display:false}, ticks:{color:muted,font:{family:'Inter',size:10}} }
        }
    };
}

function hBarOpts() {
    const muted=cssVar('--text-muted')||'#6b7089', sec=cssVar('--text-secondary')||'#a0a4b8';
    const card=cssVar('--bg-card')||'#1a1d2e', prim=cssVar('--text-primary')||'#e8eaf0';
    const bdr=cssVar('--border')||'#262a3d', grid=cssVar('--border-light')||'#2d3150';
    return {
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins: {
            legend:{display:false},
            tooltip:{ backgroundColor:card, titleColor:prim, bodyColor:sec, borderColor:bdr, borderWidth:1, padding:12, cornerRadius:8,
                callbacks:{label:ctx=>'Amount: '+fmt(ctx.parsed.x)} }
        },
        scales: {
            x:{grid:{color:grid},ticks:{color:muted,font:{family:'Inter',size:10},callback:fmt}},
            y:{grid:{display:false},ticks:{color:sec,font:{family:'Inter',size:10}}}
        }
    };
}

// ── 15. COLOURS ────────────────────────────────────────────────
function gradColors(n, from, to) {
    if (n <= 1) return [from];
    const f = hexRgb(from), t = hexRgb(to);
    return Array.from({length:n}, (_,i) => { const p=i/(n-1); return 'rgb('+lerp(f.r,t.r,p)+','+lerp(f.g,t.g,p)+','+lerp(f.b,t.b,p)+')'; });
}
function hexRgb(hex) { const h=hex.replace('#',''); return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
function lerp(a,b,t) { return Math.round(a+(b-a)*t); }

// ── 16. RENDER ALL ─────────────────────────────────────────────
function renderAll() {
    renderKPIs();
    renderGraph1();
    renderGraph2();
    renderTable();
}

// ── GO ─────────────────────────────────────────────────────────
init();
