# Owner-reviewed recurring-series maintenance

Run from `backend` using the installed backend virtual environment. These commands
do not start the app, run migrations, or change the schema. They use **only the
DATABASE_URL supplied in the process environment**, not a URL hardcoded in the
scripts. Plain PostgreSQL URLs retain the existing psycopg2 driver selection.

## Windows: connect without putting credentials in command history

Use Render's **external** PostgreSQL URL for access from your computer (the internal
Render host is normally only reachable inside Render). Configure permitted network
access and use the TLS settings provided for your database. Obtain a backup before
any apply. Prefer a read-only database account for the audit.

In PowerShell, securely paste the production URL already available to you:

```powershell
$previousDatabaseUrl = $env:DATABASE_URL
$secureDatabaseUrl = Read-Host 'Production DATABASE_URL (hidden)' -AsSecureString
$databaseCredential = [System.Net.NetworkCredential]::new('', $secureDatabaseUrl)
$env:DATABASE_URL = $databaseCredential.Password
try {
    .\.venv\Scripts\python.exe -m app.scripts.audit_recurring_series --output recurring-audit.csv
    # Review audit, then create repairs.csv with only explicitly approved series.
    .\.venv\Scripts\python.exe -m app.scripts.repair_recurring_series_manifest repairs.csv
    # AFTER reviewing the dry-run and backup, run separately if approved:
    # .\.venv\Scripts\python.exe -m app.scripts.repair_recurring_series_manifest repairs.csv --apply
} finally {
    $env:DATABASE_URL = $previousDatabaseUrl
    Remove-Variable secureDatabaseUrl, databaseCredential, previousDatabaseUrl
}
```

Never print the environment variable, paste the URL into a command, or commit it.
The URL is necessarily held in process memory/environment while connected. Use a
trusted terminal/computer. Keep audit/manifest files private and out of Git.

## Audit interpretation

CSV has one row per canonical `is_recurring` parent, including stored rule/cutoff,
parent and child duration statistics, child count/start range, recurring-child
count, flags, suggested action, confidence and notes.

Missing rules reuse the existing strict weekly/fortnightly inference (at least
three simple generated children, equal intervals/time/weekday and correct group).
Long durations (>36 hours), missing/non-positive durations, or parent/child duration
differences are **triage flags, not proof of corruption**. Legitimate multi-day
events may be flagged. No independent trustworthy occurrence-duration source is
stored in these records, so the audit cannot classify a duration as provable.
Agreement between corrupt parent and children does not prove an intended duration.

For Whisky Gigs, months-long ends without independent end-time evidence are
`suspicious duration / manual duration required`. Do not assume a duration from
20:00 or copy a guessed duration from another event. Exclude it from repair until
an owner/source confirms the intended duration.

## Manifest

```csv
parent_id,intended_duration_minutes,repair_rule,replenish
00000000000000000000000000000001,150,true,true
00000000000000000000000000000002,,true,true
00000000000000000000000000000003,90,false,false
```

Replace example IDs with actual canonical UUIDs from the audit. UUIDs with dashes
are accepted. Flags must be `true` or `false`; duration is a positive whole number
of minutes or blank. Invalid headers/rows, duplicate parents, wildcards, and empty
manifests are rejected before connecting.

- No `--apply`: report proposed end changes, safe inferred rules and future dates;
  no rows are added or changed. Preview uses the existing replenishment service
  and can briefly take its normal parent lock.
- Blank duration: never repair existing parent/child dates.
- Explicit duration: owner-confirmed `start + duration` for parent and simple
  generated children, including overnight/multi-day events. Nothing else changes.
- `repair_rule=true`: restore only a NULL rule via existing safe inference. A rule
  already present is left unchanged. Ambiguity refuses the whole selected series.
- `replenish=true`: append future children only with `--apply`, after all requested
  repairs succeed. Missing/invalid rules, ambiguous ownership/history, finite or
  cancelled parents are refused. Suspicious duration without an explicit duration
  refuses repair/replenishment rather than extending corruption.
- Each parent is locked and handled in its own transaction; any repair/generation/
  commit failure rolls back that series. Other listed parents continue. Existing
  finite cutoffs, statuses, IDs and relationships are never edited. New generated
  children use the existing service's normal IDs/relationships and 180-day horizon.
- Per-series JSON reports are printed after commit/rollback, followed by totals.
  Any series failure produces exit code 1; exit 0 means all rows succeeded. Read
  reports, not just the exit code. Driver errors are reported by type without
  printing connection details. An apply commits successful rows even when another
  row fails; re-audit before preparing a retry manifest.

No actual production repair or replenishment is performed by installing this code.
