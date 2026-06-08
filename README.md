# Transfer Payments — Detail Dashboard

Interactive recipient-level spending dashboard for Canada's federal transfer payments (2012–2026).

**Live:** https://georgetaylor3978.github.io/Transfer-Payment-Detailed-/

## Features
- Filter by Department, Agency, and Province/Location
- Time-series chart of total payments over time (combinable by department/agency)
- Annual breakdown bar chart (top 15 agencies or departments)
- Sortable, searchable recipient table (top 100 per year)
- Light/dark mode toggle

## Data Update (Quarterly)
1. Replace `TransferDetail.csv` and `AgencyMap.csv` in your local data folder
2. Update the paths in `process_data.js` if needed
3. Double-click `update.bat` — it compiles `data.json`, commits, and pushes automatically