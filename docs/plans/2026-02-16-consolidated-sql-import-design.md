# Consolidated SQL Import Design

## Problem

A new consolidated SQL dump (`dbrvfuxacvhqqe (1).sql`, 209K lines) replaces all existing data in the MassHSHockey project. The dump was exported from phpMyAdmin and contains 12 tables with updated schemas, 2 new tables, and all data consolidated from both the Old DB and SportsPress systems.

## Approach: Split into per-table SQL files

Split the monolithic dump into the existing per-table file convention (`output_final/insert_*.sql` + `schema.sql`), then update `merge-data.js` to handle the schema changes and regenerate all JSON.

## New Schema Summary

### Existing tables with schema changes

- **divisions**: added `gender` column, 11 records (was 6)
- **games**: `venue` VARCHAR replaced with `venue_id` FK; added `game_time`, `status`, `game_type`, `old_db_id`, `source_system`
- **leagues**: added `source`, `old_db_league_id`, `sp_term_id`, `old_db_id`
- **players**: added `position`, `jersey_number`, `height`, `weight`, `old_db_id`
- **player_seasons**: added `team_id` direct FK, `points`, `source_system`; `jersey_number` now int; `minutes` now bigint; has `team_season_id` (nullable)
- **seasons**: uses `start_date`/`end_date` instead of `start_year`/`end_year`
- **staff**: added `old_db_staff_id`, `sp_post_id`
- **teams**: added `old_db_team_id`, `sp_post_id`, `mapping_source` enum
- **team_seasons**: added `source`, `source_system`
- **venues**: added `address`, `city`, `state`, `zip`, `old_db_id`, `sp_venue_id`

### New tables

- **player_game_stats**: per-game goals/assists per player (~49K records)
- **team_id_mapping**: maps consolidated team IDs to old DB and SportsPress IDs (~487 records)

## Implementation Steps

1. Write `split-sql.js` to parse the consolidated dump into per-table files in `output_final/`
2. Run the splitter to replace all existing `output_final/` files
3. Update `merge-data.js` for schema changes:
   - Remove schools, split player file references
   - Handle `team_id`/`season_id` directly on player_seasons
   - Handle `venue_id` FK on games
   - Extract years from `start_date`/`end_date` on seasons
   - Add divisions.json generation
4. Run `merge-data.js` to regenerate all JSON in `data/`
5. Verify record counts and data shapes
6. Clean up stale files and one-time scripts
