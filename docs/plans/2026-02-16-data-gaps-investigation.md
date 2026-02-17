# Data Gaps Investigation — 2019-2023 Seasons

## Status: Waiting on re-export from user

## What's Working
- Seasons 1-11 (2008-2019): Full data — teams, games, players, league/division assignments
- Seasons 12-15 (2019-2023): Games with real scores exist (3,193 / 1,655 / 3,034 / 3,012 games)
- Team W/L/T now computed from games (1,275 team_seasons patched in merge-data.js)

## What's Missing (from the SQL dump)

### 1. Player/Roster Data for Seasons 12-15
- `player_seasons` table has 49,083 rows, ALL for seasons 4-11 (source: OLD_DB)
- Zero rows for seasons 12-15
- The `players` table has 49,083 entries — these appear to be 1:1 with player_seasons
- Expect ~6,000+ players per season based on seasons 4-11 patterns

### 2. League/Division Assignments for Seasons 12-15
- All `team_seasons` rows for seasons 12-15 have NULL league_id and NULL division_id
- Source system is 'SPORTSPRESS' for all of these
- Seasons 1-11 (source: OLD_DB) have proper league_id and division_id values
- 194 leagues and 11 divisions exist in the reference tables

### 3. Team Records for Seasons 12-15
- All zeros in the SQL dump (wins=0, losses=0, ties=0, etc.)
- **FIXED**: merge-data.js now computes these from games data
- But league-specific records can't be computed without league assignments

## Likely Cause
Two possibilities:
1. **Incomplete data migration**: SportsPress data was partially migrated into the consolidated DB — games were imported but player stats and league mappings weren't completed yet
2. **phpMyAdmin export limits**: `max_execution_time` or `memory_limit` caused silent truncation during export of player_seasons (the table ends cleanly with a semicolon, so it looks complete)

## Queries for User to Run
```sql
-- Check if player data exists in DB for 2019-2023
SELECT season_id, COUNT(*)
FROM player_seasons
WHERE season_id >= 12
GROUP BY season_id;

-- Check if league/division assignments exist
SELECT season_id,
       COUNT(*) as total,
       SUM(CASE WHEN league_id IS NOT NULL THEN 1 ELSE 0 END) as has_league,
       SUM(CASE WHEN division_id IS NOT NULL THEN 1 ELSE 0 END) as has_division
FROM team_seasons
WHERE season_id >= 12
GROUP BY season_id;

-- Check team_seasons record completeness
SELECT season_id,
       COUNT(*) as total,
       SUM(CASE WHEN wins + losses + ties > 0 THEN 1 ELSE 0 END) as has_records
FROM team_seasons
WHERE season_id >= 12
GROUP BY season_id;
```

## If Re-Export Has the Data
- Replace the SQL dump and re-run the pipeline
- merge-data.js should handle everything automatically (the game-stats patch only fires for zero-record teams)

## If Data Doesn't Exist in DB Either
Need to investigate:
- Does SportsPress have player roster data that wasn't migrated?
- Are league/division assignments stored in a different SportsPress table?
- Can we scrape/import from another source?

## Current Pipeline State
- Branch: `claude/elastic-wright` (2 commits ahead of main)
- Commit `bf404a4`: Replace all data with consolidated dump
- Commit `234166f`: Compute team W/L/T from games for empty records
- Both pushed to origin
