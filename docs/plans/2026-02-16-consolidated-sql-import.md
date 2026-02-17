# Consolidated SQL Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all existing MassHSHockey data with a new consolidated SQL dump, splitting it into per-table files, updating the merge script for schema changes, and regenerating all JSON.

**Architecture:** A Node.js splitter script parses the monolithic phpMyAdmin dump into per-table SQL files in `output_final/`. Then an updated `merge-data.js` reads those files and generates the JSON consumed by the web app. The JSON output shapes stay compatible with the existing app.

**Tech Stack:** Node.js (fs, path), SQL parsing, JSON generation

---

### Task 1: Copy the consolidated SQL dump into the project

**Files:**
- Create: `output_final/consolidated_dump.sql` (copy of source file)

**Step 1: Copy the file**

```bash
cp "C:/Users/Jamie/Desktop/dbrvfuxacvhqqe (1).sql" "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright/output_final/consolidated_dump.sql"
```

**Step 2: Verify the copy**

```bash
wc -l "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright/output_final/consolidated_dump.sql"
```

Expected: `209553` lines

**Step 3: Commit**

```bash
cd "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright"
git add output_final/consolidated_dump.sql
git commit -m "Add consolidated SQL dump from phpMyAdmin export"
```

---

### Task 2: Write the SQL splitter script

**Files:**
- Create: `split-sql.js`

**Step 1: Write `split-sql.js`**

This script reads `output_final/consolidated_dump.sql` and produces:
- `output_final/schema.sql` — CREATE TABLE statements, indexes, FKs, auto-increment, views
- `output_final/insert_<table>.sql` — One file per table with INSERT statements

The parser works by scanning for `-- Table structure for table` markers to identify table boundaries, then separating CREATE TABLE / INSERT INTO / ALTER TABLE / CONSTRAINT sections.

```javascript
/**
 * Split consolidated SQL dump into per-table files
 * Input: output_final/consolidated_dump.sql
 * Output: output_final/schema.sql + output_final/insert_<table>.sql per table
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'output_final', 'consolidated_dump.sql');
const OUTPUT_DIR = path.join(__dirname, 'output_final');

// Table ordering for FK-safe insertion
const TABLE_ORDER = [
    'seasons', 'leagues', 'divisions', 'venues', 'teams',
    'team_id_mapping', 'team_seasons', 'games',
    'players', 'player_seasons', 'player_game_stats',
    'staff', 'staff_teams'
];

function splitSQL() {
    console.log('Reading consolidated dump...');
    const sql = fs.readFileSync(INPUT, 'utf8');
    const lines = sql.split('\n');

    // Collect sections by table
    const tableCreateSQL = {};   // table -> CREATE TABLE lines
    const tableInsertSQL = {};   // table -> INSERT lines
    const indexLines = [];       // All ALTER TABLE ADD KEY/PRIMARY lines
    const autoIncLines = [];     // All ALTER TABLE MODIFY AUTO_INCREMENT lines
    const constraintLines = [];  // All ALTER TABLE ADD CONSTRAINT lines
    const headerLines = [];      // SET statements at top

    let currentTable = null;
    let section = 'header'; // header, create, data, indexes, autoinc, constraints

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect table structure sections
        if (trimmed.startsWith('-- Table structure for table')) {
            const match = trimmed.match(/`(\w+)`/);
            if (match) {
                currentTable = match[1];
                section = 'create';
                if (!tableCreateSQL[currentTable]) tableCreateSQL[currentTable] = [];
                if (!tableInsertSQL[currentTable]) tableInsertSQL[currentTable] = [];
                continue;
            }
        }

        // Detect "Dumping data" sections
        if (trimmed.startsWith('-- Dumping data for table')) {
            const match = trimmed.match(/`(\w+)`/);
            if (match) {
                currentTable = match[1];
                section = 'data';
                continue;
            }
        }

        // Detect index sections
        if (trimmed.startsWith('-- Indexes for dumped tables')) {
            section = 'indexes';
            currentTable = null;
            continue;
        }
        if (section === 'indexes' && trimmed.startsWith('-- Indexes for table')) {
            const match = trimmed.match(/`(\w+)`/);
            if (match) currentTable = match[1];
            continue;
        }

        // Detect auto-increment sections
        if (trimmed.startsWith('-- AUTO_INCREMENT for dumped tables')) {
            section = 'autoinc';
            currentTable = null;
            continue;
        }
        if (section === 'autoinc' && trimmed.startsWith('-- AUTO_INCREMENT for table')) {
            const match = trimmed.match(/`(\w+)`/);
            if (match) currentTable = match[1];
            continue;
        }

        // Detect constraint sections
        if (trimmed.startsWith('-- Constraints for dumped tables')) {
            section = 'constraints';
            currentTable = null;
            continue;
        }
        if (section === 'constraints' && trimmed.startsWith('-- Constraints for table')) {
            const match = trimmed.match(/`(\w+)`/);
            if (match) currentTable = match[1];
            continue;
        }

        // Skip empty comment lines and section dividers
        if (trimmed === '--' || trimmed.startsWith('-- ------')) continue;

        // Collect lines by section
        if (section === 'header') {
            if (trimmed && !trimmed.startsWith('--')) {
                headerLines.push(line);
            }
        } else if (section === 'create') {
            if (currentTable && (trimmed.startsWith('DROP TABLE') || trimmed.startsWith('CREATE TABLE') || trimmed.startsWith('`') || trimmed.startsWith(')') || trimmed === '')) {
                tableCreateSQL[currentTable].push(line);
            }
        } else if (section === 'data') {
            if (currentTable && (trimmed.startsWith('INSERT INTO') || trimmed.startsWith('('))) {
                tableInsertSQL[currentTable].push(line);
            }
        } else if (section === 'indexes') {
            if (trimmed.startsWith('ALTER TABLE') || trimmed.startsWith('ADD ')) {
                indexLines.push(line);
            }
        } else if (section === 'autoinc') {
            if (trimmed.startsWith('ALTER TABLE') || trimmed.startsWith('MODIFY ')) {
                autoIncLines.push(line);
            }
        } else if (section === 'constraints') {
            if (trimmed.startsWith('ALTER TABLE') || trimmed.startsWith('ADD CONSTRAINT')) {
                constraintLines.push(line);
            }
        }
    }

    // Write schema.sql
    console.log('Writing schema.sql...');
    let schema = '-- ============================================================\n';
    schema += '-- MASSHSHOCKEY UNIFIED DATABASE SCHEMA\n';
    schema += '-- Generated from consolidated dump on ' + new Date().toISOString().split('T')[0] + '\n';
    schema += '-- ============================================================\n\n';
    schema += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

    // Drop tables in reverse order
    for (const table of [...TABLE_ORDER].reverse()) {
        schema += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    }
    schema += '\n';

    // Create tables in order
    for (const table of TABLE_ORDER) {
        if (tableCreateSQL[table]) {
            const createLines = tableCreateSQL[table]
                .filter(l => !l.trim().startsWith('DROP TABLE'))
                .join('\n')
                .trim();
            if (createLines) {
                schema += createLines + '\n\n';
            }
        }
    }

    // Indexes
    if (indexLines.length > 0) {
        schema += '-- Indexes\n';
        schema += indexLines.join('\n') + '\n\n';
    }

    // Auto-increment
    if (autoIncLines.length > 0) {
        schema += '-- Auto-increment\n';
        schema += autoIncLines.join('\n') + '\n\n';
    }

    // Constraints (foreign keys)
    if (constraintLines.length > 0) {
        schema += '-- Foreign key constraints\n';
        schema += constraintLines.join('\n') + '\n\n';
    }

    schema += 'SET FOREIGN_KEY_CHECKS = 1;\n\n';

    // Views (recreate from design)
    schema += '-- VIEWS\n';
    schema += `CREATE OR REPLACE VIEW v_standings AS
SELECT ts.id, t.name AS team, t.gender, s.name AS season,
       l.name AS league, d.name AS division,
       ts.wins, ts.losses, ts.ties, ts.points,
       ts.goals_for, ts.goals_against,
       (ts.goals_for - ts.goals_against) AS goal_diff, ts.win_pct
FROM team_seasons ts
JOIN teams t ON ts.team_id = t.id
JOIN seasons s ON ts.season_id = s.id
LEFT JOIN leagues l ON ts.league_id = l.id
LEFT JOIN divisions d ON ts.division_id = d.id;\n\n`;

    schema += `CREATE OR REPLACE VIEW v_schedule AS
SELECT g.id, g.game_date, g.game_time, s.name AS season,
       ht.name AS home_team, g.home_score,
       at2.name AS away_team, g.away_score,
       v.name AS venue, g.status, g.game_type
FROM games g
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at2 ON g.away_team_id = at2.id
JOIN seasons s ON g.season_id = s.id
LEFT JOIN venues v ON g.venue_id = v.id;\n\n`;

    schema += `CREATE OR REPLACE VIEW v_player_stats AS
SELECT ps.id, p.first_name, p.last_name,
       CONCAT(p.first_name, ' ', p.last_name) AS player_name,
       t.name AS team, s.name AS season,
       ps.jersey_number, ps.position_name, ps.year,
       ps.games_played, ps.goals, ps.assists,
       (ps.goals + ps.assists) AS total_points,
       ps.goals_against, ps.goals_against_average, ps.save_percentage
FROM player_seasons ps
JOIN players p ON ps.player_id = p.id
JOIN teams t ON ps.team_id = t.id
JOIN seasons s ON ps.season_id = s.id;\n`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'schema.sql'), schema);

    // Write per-table insert files
    for (const table of TABLE_ORDER) {
        const inserts = tableInsertSQL[table];
        if (inserts && inserts.length > 0) {
            const filename = `insert_${table}.sql`;
            const content = inserts.join('\n') + '\n';
            fs.writeFileSync(path.join(OUTPUT_DIR, filename), content);
            console.log(`  Written ${filename} (${inserts.length} lines)`);
        } else {
            console.log(`  WARNING: No insert data found for table ${table}`);
        }
    }

    console.log('\nSplit complete!');
}

splitSQL();
```

**Step 2: Run the splitter**

```bash
cd "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright"
node split-sql.js
```

Expected output: Lines written for each table, no warnings.

**Step 3: Verify output files exist and have data**

```bash
wc -l output_final/insert_*.sql output_final/schema.sql
```

Expected: Non-zero line counts for all files. Key counts to check:
- `insert_games.sql` ~44K+ lines
- `insert_players.sql` ~49K+ lines
- `insert_player_seasons.sql` ~49K+ lines
- `insert_team_seasons.sql` ~4.5K+ lines

**Step 4: Commit**

```bash
git add split-sql.js output_final/
git commit -m "Split consolidated SQL dump into per-table files

Replaces all existing output_final/ SQL files with data from
the new consolidated phpMyAdmin dump. Adds new tables:
player_game_stats, team_id_mapping."
```

---

### Task 3: Update merge-data.js for new schema

**Files:**
- Modify: `merge-data.js`

This is the most complex task. The updated script must handle:

1. **Seasons**: `start_date`/`end_date` instead of `start_year`/`end_year`
2. **Players lookup**: `player_seasons` now has direct `team_id` and `season_id`
3. **Games**: `venue_id` FK instead of `venue` VARCHAR; new `game_time`, `status`, `game_type`
4. **Divisions**: now includes `gender` column
5. **Remove**: schools references, split player file references

**Step 1: Write the updated `merge-data.js`**

The full replacement script (preserving the existing SQL parser functions which work fine):

```javascript
/**
 * MassHSHockey Data Merge Script
 * Parses SQL INSERT statements from output_final and generates JSON files
 * Updated for consolidated database schema (Feb 2026)
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = './output_final';
const OUTPUT_DIR = './data';

// ---- SQL Parsing (unchanged) ----

function parseSQLInserts(sql, tableName) {
    const results = [];
    const lines = sql.split('\n');
    let columns = [];
    let inValues = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;

        if (!inValues && trimmed.toUpperCase().includes('INSERT INTO')) {
            const colMatch = trimmed.match(/\(([^)]+)\)\s*VALUES/i);
            if (colMatch) {
                columns = colMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
                inValues = true;
            }
            continue;
        }

        if (inValues && trimmed.startsWith('(')) {
            const rowMatch = trimmed.match(/^\((.+)\)[,;]?\s*$/);
            if (rowMatch) {
                const values = parseRowValues(rowMatch[1]);
                if (values.length === columns.length) {
                    const obj = {};
                    columns.forEach((col, idx) => {
                        obj[col] = values[idx];
                    });
                    results.push(obj);
                }
            }
        }

        if (trimmed.endsWith(';')) {
            inValues = false;
        }
    }

    return results;
}

function parseRowValues(rowStr) {
    const values = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let escaped = false;

    for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];

        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if ((char === "'" || char === '"') && !inQuote) {
            inQuote = true;
            quoteChar = char;
            continue;
        }

        if (char === quoteChar && inQuote) {
            inQuote = false;
            quoteChar = '';
            continue;
        }

        if (char === ',' && !inQuote) {
            values.push(parseValue(current.trim()));
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim()) {
        values.push(parseValue(current.trim()));
    }

    return values;
}

function parseValue(val) {
    if (val === 'NULL' || val === 'null') return null;
    if (val === 'TRUE' || val === 'true') return true;
    if (val === 'FALSE' || val === 'false') return false;
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
    return val;
}

function readSQLFile(filename) {
    const filepath = path.join(INPUT_DIR, filename);
    if (!fs.existsSync(filepath)) {
        console.log(`  File not found: ${filepath}`);
        return '';
    }
    return fs.readFileSync(filepath, 'utf8');
}

// ---- Main Merge ----

async function mergeData() {
    console.log('Starting data merge...\n');

    // 1. Parse all tables
    console.log('Parsing seasons...');
    const seasons = parseSQLInserts(readSQLFile('insert_seasons.sql'), 'seasons');
    console.log(`  Found ${seasons.length} seasons`);

    console.log('Parsing leagues...');
    const leagues = parseSQLInserts(readSQLFile('insert_leagues.sql'), 'leagues');
    console.log(`  Found ${leagues.length} leagues`);

    console.log('Parsing divisions...');
    const divisions = parseSQLInserts(readSQLFile('insert_divisions.sql'), 'divisions');
    console.log(`  Found ${divisions.length} divisions`);

    console.log('Parsing venues...');
    const venues = parseSQLInserts(readSQLFile('insert_venues.sql'), 'venues');
    console.log(`  Found ${venues.length} venues`);

    console.log('Parsing teams...');
    const teams = parseSQLInserts(readSQLFile('insert_teams.sql'), 'teams');
    console.log(`  Found ${teams.length} teams`);

    console.log('Parsing team_seasons...');
    const teamSeasons = parseSQLInserts(readSQLFile('insert_team_seasons.sql'), 'team_seasons');
    console.log(`  Found ${teamSeasons.length} team_seasons`);

    console.log('Parsing games...');
    const games = parseSQLInserts(readSQLFile('insert_games.sql'), 'games');
    console.log(`  Found ${games.length} games`);

    console.log('Parsing players...');
    const players = parseSQLInserts(readSQLFile('insert_players.sql'), 'players');
    console.log(`  Found ${players.length} players`);

    console.log('Parsing player_seasons...');
    const playerSeasons = parseSQLInserts(readSQLFile('insert_player_seasons.sql'), 'player_seasons');
    console.log(`  Found ${playerSeasons.length} player_seasons`);

    console.log('Parsing staff...');
    const staffSQL = readSQLFile('insert_staff.sql');
    const staff = staffSQL ? parseSQLInserts(staffSQL, 'staff') : [];
    console.log(`  Found ${staff.length} staff`);

    console.log('Parsing staff_teams...');
    const staffTeamsSQL = readSQLFile('insert_staff_teams.sql');
    const staffTeams = staffTeamsSQL ? parseSQLInserts(staffTeamsSQL, 'staff_teams') : [];
    console.log(`  Found ${staffTeams.length} staff_teams`);

    // 2. Build lookup maps
    console.log('\nBuilding lookup maps...');
    const seasonMap = new Map(seasons.map(s => [s.id, s]));
    const leagueMap = new Map(leagues.map(l => [l.id, l]));
    const divisionMap = new Map(divisions.map(d => [d.id, d]));
    const venueMap = new Map(venues.map(v => [v.id, v]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const teamSeasonMap = new Map(teamSeasons.map(ts => [ts.id, ts]));
    const playerMap = new Map(players.map(p => [p.id, p]));
    const staffMap = new Map(staff.map(s => [s.id, s]));

    // 3. Generate seasons.json
    console.log('\nGenerating seasons.json...');
    const seasonsJson = seasons.map(s => {
        // Extract years from start_date/end_date (format: YYYY-MM-DD)
        const startYear = s.start_date ? parseInt(s.start_date.substring(0, 4)) : null;
        const endYear = s.end_date ? parseInt(s.end_date.substring(0, 4)) : null;
        const displayName = s.name.includes('Season') ? s.name : `${s.name} Season`;
        return {
            id: String(s.id),
            name: s.name,
            display_name: displayName,
            start_year: startYear,
            end_year: endYear
        };
    });

    // 4. Generate leagues.json
    console.log('Generating leagues.json...');
    const leaguesJson = leagues.map(l => ({
        id: String(l.id),
        name: l.name,
        short_name: l.short_name || null,
        gender: l.gender || 'M'
    }));

    // 5. Generate divisions.json
    console.log('Generating divisions.json...');
    const divisionsJson = divisions.map(d => ({
        id: String(d.id),
        name: d.name,
        gender: d.gender || null
    }));

    // 6. Generate team_seasons.json
    console.log('Generating team_seasons.json...');
    const teamSeasonsJson = teamSeasons.map(ts => {
        const team = teamMap.get(ts.team_id);
        const season = seasonMap.get(ts.season_id);
        const league = ts.league_id ? leagueMap.get(ts.league_id) : null;
        const division = ts.division_id ? divisionMap.get(ts.division_id) : null;

        return {
            id: String(ts.id),
            team_id: String(ts.team_id),
            team_name: team ? team.name : 'Unknown',
            season_id: String(ts.season_id),
            season_name: season ? (season.name.includes('Season') ? season.name : `${season.name} Season`) : 'Unknown',
            league_id: ts.league_id ? String(ts.league_id) : null,
            league_name: league ? league.name : 'Independent',
            division_id: ts.division_id ? String(ts.division_id) : null,
            division_name: division ? division.name : null,
            gender: team ? team.gender : 'M',
            overall: {
                wins: ts.wins || 0,
                losses: ts.losses || 0,
                ties: ts.ties || 0,
                goals_for: ts.goals_for || 0,
                goals_against: ts.goals_against || 0,
                points: ts.points || 0,
                win_pct: ts.win_pct || 0
            }
        };
    });

    // 7. Generate games.json
    console.log('Generating games.json...');
    const gamesJson = games.map(g => {
        const homeTeam = teamMap.get(g.home_team_id);
        const awayTeam = teamMap.get(g.away_team_id);
        const season = seasonMap.get(g.season_id);
        const venue = g.venue_id ? venueMap.get(g.venue_id) : null;

        let timestamp = null;
        if (g.game_date) {
            const timeStr = g.game_time || '12:00:00';
            const d = new Date(g.game_date + 'T' + timeStr);
            timestamp = Math.floor(d.getTime() / 1000);
        }

        return {
            id: String(g.id),
            date: g.game_date,
            time: g.game_time || null,
            timestamp: timestamp,
            home_team_id: String(g.home_team_id),
            away_team_id: String(g.away_team_id),
            home_team: homeTeam ? homeTeam.name : 'Unknown',
            away_team: awayTeam ? awayTeam.name : 'Unknown',
            home_score: g.home_score,
            away_score: g.away_score,
            location_id: g.venue_id ? String(g.venue_id) : null,
            venue: venue ? venue.name : null,
            season_id: String(g.season_id),
            season_name: season ? (season.name.includes('Season') ? season.name : `${season.name} Season`) : 'Unknown',
            status: g.status || 'Final',
            game_type: g.game_type || 'Regular Season'
        };
    });

    // 8. Generate players.json
    console.log('Generating players.json...');
    const playersJson = playerSeasons.map(ps => {
        const player = playerMap.get(ps.player_id);

        // Get team directly from team_id on player_seasons
        let team = ps.team_id ? teamMap.get(ps.team_id) : null;
        let seasonId = ps.season_id;

        // Fallback to team_season_id if team_id not available
        if (!team && ps.team_season_id) {
            const ts = teamSeasonMap.get(ps.team_season_id);
            if (ts) {
                team = teamMap.get(ts.team_id);
                if (!seasonId) seasonId = ts.season_id;
            }
        }

        const season = seasonId ? seasonMap.get(seasonId) : null;

        return {
            id: String(ps.id),
            player_id: String(ps.player_id),
            first_name: player ? player.first_name : '',
            last_name: player ? player.last_name : '',
            name: player ? `${player.first_name} ${player.last_name}` : '',
            position: ps.position_name || (ps.position === 'G' ? 'Goalie' : ps.position === 'D' ? 'Defense' : 'Forward'),
            captain: ps.is_captain || 'N',
            team_id: team ? String(ps.team_id || (ps.team_season_id ? teamSeasonMap.get(ps.team_season_id)?.team_id : null)) : null,
            team_name: team ? team.name : 'Unknown',
            season_id: seasonId ? String(seasonId) : null,
            season_name: season ? (season.name.includes('Season') ? season.name : `${season.name} Season`) : 'Unknown',
            team_season_id: ps.team_season_id ? String(ps.team_season_id) : null,
            number: ps.jersey_number != null ? parseInt(ps.jersey_number) || 0 : 0,
            year: ps.year || '',
            hometown: ps.hometown || '',
            goals: ps.goals || 0,
            assists: ps.assists || 0,
            points: ps.points || ((ps.goals || 0) + (ps.assists || 0)),
            games_played: ps.games_played || 0,
            penalty_minutes: ps.penalty_minutes || 0,
            goals_against: ps.goals_against || 0,
            goals_against_average: ps.goals_against_average || 0,
            shots: ps.shots || 0,
            saves: ps.saves || 0,
            save_percentage: ps.save_percentage || 0,
            shutouts: ps.shutouts || 0,
            minutes: ps.minutes || 0
        };
    });

    // 9. Write output files
    console.log('\nWriting output files...');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, 'seasons.json'), JSON.stringify(seasonsJson, null, 2));
    console.log(`  Written seasons.json (${seasonsJson.length} records)`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'leagues.json'), JSON.stringify(leaguesJson, null, 2));
    console.log(`  Written leagues.json (${leaguesJson.length} records)`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'divisions.json'), JSON.stringify(divisionsJson, null, 2));
    console.log(`  Written divisions.json (${divisionsJson.length} records)`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'teams.json'), JSON.stringify(teamSeasonsJson, null, 2));
    console.log(`  Written teams.json (${teamSeasonsJson.length} records)`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'team_seasons.json'), JSON.stringify(teamSeasonsJson, null, 2));
    console.log(`  Written team_seasons.json (${teamSeasonsJson.length} records)`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'games.json'), JSON.stringify(gamesJson, null, 2));
    console.log(`  Written games.json (${gamesJson.length} records)`);

    fs.writeFileSync(path.join(OUTPUT_DIR, 'players.json'), JSON.stringify(playersJson, null, 2));
    console.log(`  Written players.json (${playersJson.length} records)`);

    // Venues
    const venuesJson = venues.map(v => ({
        id: String(v.id),
        name: v.name,
        address: v.address || '',
        city: v.city || '',
        state: v.state || '',
        zip: v.zip || ''
    }));
    fs.writeFileSync(path.join(OUTPUT_DIR, 'venues.json'), JSON.stringify(venuesJson, null, 2));
    console.log(`  Written venues.json (${venuesJson.length} records)`);

    // Locations (alias for venues, for backwards compat with data-loader.js)
    fs.writeFileSync(path.join(OUTPUT_DIR, 'locations.json'), JSON.stringify(venuesJson, null, 2));
    console.log(`  Written locations.json (alias for venues)`);

    // Staff (enriched with team info)
    const staffJson = staffTeams.map(st => {
        const s = staffMap.get(st.staff_id);
        const team = teamMap.get(st.team_id);
        return {
            staff_id: String(st.staff_id),
            first_name: s ? s.first_name : '',
            last_name: s ? s.last_name : '',
            name: s ? `${s.first_name} ${s.last_name}` : '',
            role: s ? s.role : 'Coach',
            team_id: String(st.team_id),
            team_name: team ? team.name : 'Unknown',
            team_gender: team ? team.gender : 'M'
        };
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, 'staff.json'), JSON.stringify(staffJson, null, 2));
    console.log(`  Written staff.json (${staffJson.length} records)`);

    // 10. Generate season-specific files
    console.log('\nGenerating season-specific files...');
    const seasonsDir = path.join(OUTPUT_DIR, 'seasons');
    if (!fs.existsSync(seasonsDir)) {
        fs.mkdirSync(seasonsDir, { recursive: true });
    }

    for (const season of seasons) {
        const sid = String(season.id);
        const seasonTeams = teamSeasonsJson.filter(t => t.season_id === sid);
        const seasonGames = gamesJson.filter(g => g.season_id === sid);
        const seasonPlayers = playersJson.filter(p => p.season_id === sid);

        const seasonData = {
            id: sid,
            name: season.name,
            display_name: season.name.includes('Season') ? season.name : `${season.name} Season`,
            teams: seasonTeams,
            games: seasonGames,
            players: seasonPlayers
        };

        fs.writeFileSync(
            path.join(seasonsDir, `${season.id}.json`),
            JSON.stringify(seasonData, null, 2)
        );
        console.log(`  Written seasons/${season.id}.json (${seasonTeams.length} teams, ${seasonGames.length} games, ${seasonPlayers.length} players)`);
    }

    // Summary
    console.log('\n========================================');
    console.log('MERGE COMPLETE!');
    console.log('========================================');
    console.log(`Seasons: ${seasonsJson.length}`);
    console.log(`Leagues: ${leaguesJson.length}`);
    console.log(`Divisions: ${divisionsJson.length}`);
    console.log(`Team Seasons: ${teamSeasonsJson.length}`);
    console.log(`Games: ${gamesJson.length}`);
    console.log(`Players: ${playersJson.length}`);
    console.log(`Venues: ${venuesJson.length}`);
    console.log(`Staff: ${staffJson.length}`);
    console.log('========================================\n');
}

mergeData().catch(err => {
    console.error('Error during merge:', err);
    process.exit(1);
});
```

**Step 2: Run merge-data.js**

```bash
cd "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright"
node merge-data.js
```

Expected: All record counts printed, no errors. Key expected counts:
- Seasons: 15
- Divisions: 11
- Teams (team_seasons): ~5,700
- Games: ~44,700
- Players (player_seasons): ~49,000
- Venues: ~264

**Step 3: Spot-check a few JSON files**

Verify `data/seasons.json` has 15 entries with proper names.
Verify `data/divisions.json` has 11 entries with gender field.
Verify `data/players.json` first entry has goalie stats (save_percentage, goals_against, etc.).
Verify `data/games.json` first entry has venue name resolved from venue_id.

**Step 4: Commit**

```bash
git add merge-data.js data/
git commit -m "Update merge-data.js for new schema and regenerate all JSON

- Handle direct team_id/season_id on player_seasons
- Handle venue_id FK on games (resolve venue names)
- Extract years from start_date/end_date on seasons
- Generate divisions.json with gender column
- Generate locations.json as venues alias
- Remove schools and split-file references
- Regenerate all JSON from consolidated data"
```

---

### Task 4: Clean up and verify

**Files:**
- Delete: `output_final/consolidated_dump.sql` (large file, not needed in repo)
- Delete: `split-sql.js` (one-time tool)
- Delete: `data/backup_*` directories if any exist

**Step 1: Remove one-time files**

```bash
rm "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright/output_final/consolidated_dump.sql"
rm "P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright/split-sql.js"
```

**Step 2: Remove stale backup directories**

```bash
rm -rf P:/Claude/MassHSHockey/.claude/worktrees/elastic-wright/data/backup_*
```

**Step 3: Verify the app loads correctly**

Open `index.html` in a browser and verify:
- Season dropdown populates with 15 seasons
- Selecting a season shows teams in standings
- Games tab shows game results with venue names
- Players tab shows player stats including goalie stats

**Step 4: Final commit**

```bash
git add -A
git commit -m "Clean up one-time import files"
```
