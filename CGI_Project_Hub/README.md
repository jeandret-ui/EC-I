# CGI Project Hub v12.1 — Controlgear Instramac

One local project-management dashboard that merges **CGI Project Hub V11** (schedule, registers, RF design lab,
notes/AI tracker) and **CGI Project Dashboard V3** (costing, quote register, pipeline & forecasts), and adds
meetings & minutes, RACI, FAT/SAT & punch list, procurement tracking, PMP charter, calendar, reminders and a
multi-project portfolio — in CGI branding.

## Start it

1. Extract the **whole ZIP** to a folder on your PC, e.g. `C:\CGI\CGI_Project_Hub` (keep the `runtime` folder).
2. Double-click **`CGI Project Hub.vbs`**. The hub starts quietly in the background, opens in your browser,
   and puts a **CGI Project Hub** shortcut (CGI icon) on your desktop. From then on just use the desktop shortcut.
3. To stop it: Settings › *Stop the hub*, or `Stop CGI Project Hub.bat`.

No installation, internet or admin rights needed: a Windows x64 Python runtime is included.
If anything goes wrong, run **`Start CGI Project Hub (console).bat`** to see messages, or read
`%LOCALAPPDATA%\CGI Project Hub\hub.log`.

## Where your data lives

Everything that is not the program is saved in your storage folder, set in `storage_location.txt`:

```
C:\Users\Jeandre.t\OneDrive - Instramac\Desktop\Local Dashboard Storage
├─ Projects\
│  └─ IWECMOL003 - Molepolole WWTW Telemetry\
│     ├─ project.json          profile + PMP charter
│     ├─ Registers\            tasks (schedule), actions, meetings, minutes, RACI, stakeholders, procurement,
│     │                        tests, punch list, risks, issues, decisions, changes, budget, POs, invoices, …
│     ├─ Costing\              costing documents (quotes / revisions) for this project, with _history
│     ├─ Documents\            attachments (per record) and any files you drop in via Explorer
│     ├─ Tracker\              notes, voice notes, AI proposals, daily summaries
│     ├─ RF Lab\               RF design state (projects with the RF lab switched on)
│     ├─ audit.jsonl           every change: who, when, before/after
│     └─ _history\             automatic daily snapshots (restore in Settings)
├─ Commercial\                 company quote register (1,648 records), register backups, unassigned costings
├─ Settings\                   app settings (API keys stay on this PC only: %LOCALAPPDATA%\CGI Project Hub)
└─ Archive\                    archived projects
```

Files are plain JSON, written atomically so OneDrive never syncs a half-written file. Copy the whole storage
folder to back up or move PCs; change the path in Settings or `storage_location.txt`.

## What's inside

| Area | Highlights |
|---|---|
| **Portfolio** | All projects with RAG health, progress, contract value, next milestone; portfolio timeline; what's coming up; needs attention |
| **My work** | Every open action, to-do, reminder, punch item, delivery and meeting across projects, by owner; tick to complete; export to Outlook (.ics) |
| **Calendar** | Month view of milestones, tasks, meetings, due actions, deliveries, tests, payments; click a day to add; .ics export |
| **Overview** | Project hero, KPIs, mini Gantt, workstream progress, 14-day lookahead, alerts, recent changes |
| **Profile & charter** | PMP charter: objectives, scope, exclusions, assumptions, constraints, success criteria, milestones; printable |
| **Schedule** | Critical-path Gantt (working days, FS + lag), by WBS or by workstream lanes (waterfall *and* parallel streams), baseline & slip, today/target lines |
| **Task board** | Kanban by status with drag & drop; each task has its own to-do checklist |
| **Meetings & minutes** | Agenda, attendees from stakeholders, minutes items (discussion / decision / action), one-click *Create action* (assigned, dated, in My work), decision log, carry-forward of open actions, print / email minutes, Outlook invite |
| **Actions & to-dos** | Open / overdue / by owner, reminders with desktop pop-ups |
| **Risks & changes** | Risk heat map, issues, decisions, change requests / variations, lessons learned |
| **Stakeholders & RACI** | Client, contractors, suppliers, CGI team; click-to-cycle RACI matrix with accountability check; power/interest grid |
| **Procurement** | Item pipeline (spec → RFQ → ordered → delivered → inspected → installed), need-by warnings, supplier quotes & comparison, supplier POs |
| **FAT / SAT** | Tests with criteria, witnesses, results and sign-off; punch list A/B/C; printable test record |
| **Technical** | Requirements, deliverables, RFIs, document register, deviations; **site diary** |
| **Commercials** | Contract value, budget by cost code, committed / actual / forecast, margin, invoices, cash flow, costing documents |
| **Costing & quotes** | The full V3 costing workbook replacement (profile, summary, costing, rates library, quotation preview, Excel export) per project, plus the **quote register** and **pipeline & forecasts** |
| **RF design lab** | The V11 RF lab (maps, 3D terrain, link budgets, TTA check), state saved per project |
| **Notes & AI tracker** | Log notes / dictate / record voice; with a Claude key, proposed register updates you approve; daily summaries; ask the project |
| **Documents** | Per-project folders, drag-and-drop upload, open in Explorer |
| **Settings** | Storage path, your name, snapshots & restore, JSON backup/restore, import from V11 / V3, AI & Telegram |

## New in v12.1 (ideas from the TMM implementation section)

* **Interactive Gantt** — edit the task list in place (name, owner, days, waits-for, %), fold groups, indent / outdent /
  move rows (WBS codes renumber and links follow), drag bars to move or stretch, resizable task list, planned-vs-actual ghosts.
* **This week** — tiles that filter (overdue, this week, no owner, days to the next milestone, status), one-tap owner,
  +25 % and Done, quick add, a soft limit on how much one person holds, and a **weekly review** that steps through items.
* **Look-ahead** — the next three weeks with readiness checks tapped round (materials, drawings, access & permits, people,
  tools, client/site) plus automatic checks (work before it, owner away), commit the week's work, **PPC** plan reliability.
* **Status updates** — On track / At risk / Off track, drafted from the project, kept as a history, shown on the overview
  and portfolio.
* **Team** — a card per person with a 14-day availability strip (on site / office / other duties / leave), site clearance,
  papers with expiry, and their open work. The **site diary** starts from the team plan and the schedule.
* **Records open in a side sheet** with comments & photos and a "What changed" history from the audit log.

## First run

The first start creates **IWECMOL003 – Molepolole WWTW Telemetry** from `IWECMOL003 Schedule.xlsx`
(dated activities, procurement items and notes), the V11 Molepolole content (requirements, deliverables,
RF actions, RFI, deviation, cost codes, Tabateq quote) and the quote-register record (PO023758, WEC Projects).
Items without dates in the schedule are flagged so you can complete them.
Create more projects with **New project** — pick an awarded job from the quote register to pre-fill code,
client, PO, value, contact and dates, and choose a template (EC&I standard, Telemetry, or blank).

## Earlier versions

Settings › *Import from earlier versions* reads an old Hub V11 folder (`store\hub.sqlite3`) or Dashboard V3
folder (`data\`). Existing records are never overwritten.

## For maintainers

* `hub.py` entry point · `server/` (standard-library HTTP + JSON storage) · `web/` (UI, no build step)
* `config/entities.json` defines every register — add a field there and restart.
* `modules/costing/` = V3 costing & quote register (served at `/costing/`), patched to save per project.
* `modules/rflab/` = V11 RF lab; rebuild with `python tools/build_rflab.py`.
* `tools/make_seed_iwecmol003.py` rebuilds the first-run data from the schedule workbook.
* `python tests/test_hub.py` runs the API checks against a temporary storage folder.
