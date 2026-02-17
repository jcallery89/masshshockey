/**
 * MassHSHockey Data Merge Script
 * Parses SQL INSERT statements from output_final and generates JSON files
 * for the web application's data layer.
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = './output_final';
const OUTPUT_DIR = './data';

// ============================================================
// SQL Parser Functions (unchanged from original)
// ============================================================

// Helper to parse SQL INSERT statements - line by line approach
function parseSQLInserts(sql, tableName) {
    const results = [];

    // Split by lines for easier processing
    const lines = sql.split('\n');

    // Find column names from the INSERT line
    let columns = [];
    let inValues = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('--')) continue;

        // Look for INSERT INTO ... (columns) VALUES
        if (!inValues && trimmed.toUpperCase().includes('INSERT INTO')) {
            const colMatch = trimmed.match(/\(([^)]+)\)\s*VALUES/i);
            if (colMatch) {
                columns = colMatch[1].split(',').map(c => c.trim().replace(/`/g, ''));
                inValues = true;
            }
            continue;
        }

        // Parse data rows - they start with ( and contain data
        if (inValues && trimmed.startsWith('(')) {
            // Extract the content between parentheses
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

        // End of INSERT
        if (trimmed.endsWith(';')) {
            inValues = false;
        }
    }

    return results;
}

// Parse a single row of values, handling quoted strings and NULLs
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

    // Don't forget the last value
    if (current.trim()) {
        values.push(parseValue(current.trim()));
    }

    return values;
}

// Convert string value to appropriate type
function parseValue(val) {
    if (val === 'NULL' || val === 'null') return null;
    if (val === 'TRUE' || val === 'true') return true;
    if (val === 'FALSE' || val === 'false') return false;

    // Check if it's a number
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);

    return val;
}

// Read and parse a SQL file
function readSQLFile(filename) {
    const filepath = path.join(INPUT_DIR, filename);
    if (!fs.existsSync(filepath)) {
        console.log(`File not found: ${filepath}`);
        return '';
    }
    return fs.readFileSync(filepath, 'utf8');
}

// ============================================================
// Helper: format season display name
// ============================================================
function seasonDisplayName(name) {
    if (!name) return 'Unknown';
    return name.includes('Season') ? name : `${name} Season`;
}

// ============================================================
// Main merge function
// ============================================================
async function mergeData() {
    console.log('Starting data merge...\n');

    // --------------------------------------------------------
    // 1. Parse all data tables from output_final/insert_*.sql
    // --------------------------------------------------------
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

    console.log('Parsing player_game_stats...');
    const playerGameStats = parseSQLInserts(readSQLFile('insert_player_game_stats.sql'), 'player_game_stats');
    console.log(`  Found ${playerGameStats.length} player_game_stats`);

    console.log('Parsing staff...');
    const staff = parseSQLInserts(readSQLFile('insert_staff.sql'), 'staff');
    console.log(`  Found ${staff.length} staff`);

    console.log('Parsing staff_teams...');
    const staffTeams = parseSQLInserts(readSQLFile('insert_staff_teams.sql'), 'staff_teams');
    console.log(`  Found ${staffTeams.length} staff_teams`);

    // --------------------------------------------------------
    // 2. Build lookup maps
    // --------------------------------------------------------
    console.log('\nBuilding lookup maps...');

    const seasonMap = new Map(seasons.map(s => [s.id, s]));
    const leagueMap = new Map(leagues.map(l => [l.id, l]));
    const divisionMap = new Map(divisions.map(d => [d.id, d]));
    const venueMap = new Map(venues.map(v => [v.id, v]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const teamSeasonMap = new Map(teamSeasons.map(ts => [ts.id, ts]));
    const playerMap = new Map(players.map(p => [p.id, p]));
    const staffMap = new Map(staff.map(s => [s.id, s]));
    const gameMap = new Map(games.map(g => [g.id, g]));
    // Reverse lookup: "teamId_seasonId" -> team_season.id
    const teamSeasonLookup = new Map();
    teamSeasons.forEach(ts => {
        teamSeasonLookup.set(`${ts.team_id}_${ts.season_id}`, ts.id);
    });

    // --------------------------------------------------------
    // 2b. Compute W/L/T from games for team_seasons with zero records
    //     (seasons 12-15 have games but empty team_season stats)
    // --------------------------------------------------------
    console.log('\nComputing team stats from games...');

    // Build a map of (team_id, season_id) -> { wins, losses, ties, gf, ga }
    const computedStats = new Map();
    games.forEach(g => {
        if (g.home_score == null || g.away_score == null) return;
        const hs = parseInt(g.home_score) || 0;
        const as = parseInt(g.away_score) || 0;
        const sid = g.season_id;

        // Home team stats
        const hKey = `${g.home_team_id}_${sid}`;
        if (!computedStats.has(hKey)) computedStats.set(hKey, { wins: 0, losses: 0, ties: 0, gf: 0, ga: 0 });
        const hStats = computedStats.get(hKey);
        hStats.gf += hs;
        hStats.ga += as;
        if (hs > as) hStats.wins++;
        else if (hs < as) hStats.losses++;
        else hStats.ties++;

        // Away team stats
        const aKey = `${g.away_team_id}_${sid}`;
        if (!computedStats.has(aKey)) computedStats.set(aKey, { wins: 0, losses: 0, ties: 0, gf: 0, ga: 0 });
        const aStats = computedStats.get(aKey);
        aStats.gf += as;
        aStats.ga += hs;
        if (as > hs) aStats.wins++;
        else if (as < hs) aStats.losses++;
        else aStats.ties++;
    });

    // Patch team_seasons that have zero W/L/T with computed stats
    let patchedCount = 0;
    teamSeasons.forEach(ts => {
        const totalGames = (parseInt(ts.wins) || 0) + (parseInt(ts.losses) || 0) + (parseInt(ts.ties) || 0);
        if (totalGames === 0) {
            const key = `${ts.team_id}_${ts.season_id}`;
            const computed = computedStats.get(key);
            if (computed && (computed.wins + computed.losses + computed.ties) > 0) {
                ts.wins = computed.wins;
                ts.losses = computed.losses;
                ts.ties = computed.ties;
                ts.goals_for = computed.gf;
                ts.goals_against = computed.ga;
                ts.points = computed.wins * 2 + computed.ties;
                const total = computed.wins + computed.losses + computed.ties;
                ts.win_pct = total > 0 ? parseFloat(((computed.wins * 2 + computed.ties) / (total * 2)).toFixed(3)) : 0;
                patchedCount++;
            }
        }
    });
    console.log(`  Patched ${patchedCount} team_seasons with computed stats from games`);

    // --------------------------------------------------------
    // 2c. Enrich player data from player_game_stats
    //     Derives team assignments and generates synthetic player_seasons
    //     for seasons where player_game_stats exist but player_seasons don't
    // --------------------------------------------------------
    console.log('\nEnriching player data from player_game_stats...');

    // 2c-i. Index game appearances by player_id
    // For each player_game_stats row, look up the game to get season/team info
    const playerGameAppearances = new Map(); // player_id -> [{ season_id, home_team_id, away_team_id }]
    playerGameStats.forEach(pgs => {
        const game = gameMap.get(pgs.game_id);
        if (!game) return;
        if (!playerGameAppearances.has(pgs.player_id)) {
            playerGameAppearances.set(pgs.player_id, []);
        }
        playerGameAppearances.get(pgs.player_id).push({
            season_id: game.season_id,
            home_team_id: game.home_team_id,
            away_team_id: game.away_team_id
        });
    });
    console.log(`  Indexed ${playerGameAppearances.size} players with game appearances`);

    // 2c-ii. Team derivation: find the most frequent team across a player's games
    function deriveTeamId(gameAppearances) {
        const teamCounts = new Map();
        gameAppearances.forEach(ga => {
            teamCounts.set(ga.home_team_id, (teamCounts.get(ga.home_team_id) || 0) + 1);
            teamCounts.set(ga.away_team_id, (teamCounts.get(ga.away_team_id) || 0) + 1);
        });
        // Player's team appears in every game; opponents vary.
        // Highest-count team = player's team.
        let maxCount = 0;
        let bestTeamId = null;
        for (const [teamId, count] of teamCounts) {
            if (count > maxCount) {
                maxCount = count;
                bestTeamId = teamId;
            }
        }
        return bestTeamId;
    }

    // 2c-iii. Enrich existing SportsPress player_seasons with derived team_id
    let enrichedCount = 0;
    playerSeasons.forEach(ps => {
        if (ps.team_id != null && parseInt(ps.team_id) !== 0) return; // already has team

        const appearances = playerGameAppearances.get(ps.player_id);
        if (!appearances || appearances.length === 0) return;

        // Prefer games from the same season; fall back to all games
        let seasonApps = appearances.filter(a => String(a.season_id) === String(ps.season_id));
        if (seasonApps.length === 0) seasonApps = appearances;

        const derivedTeamId = deriveTeamId(seasonApps);
        if (derivedTeamId) {
            ps.team_id = derivedTeamId;
            const tsId = teamSeasonLookup.get(`${derivedTeamId}_${ps.season_id}`);
            if (tsId) ps.team_season_id = tsId;
            if (!ps.games_played || parseInt(ps.games_played) === 0) {
                ps.games_played = seasonApps.length;
            }
            enrichedCount++;
        }
    });
    console.log(`  Enriched ${enrichedCount} existing player_seasons with derived team_id`);

    // 2c-iv. Generate synthetic player_seasons for seasons 12, 14, 15
    //        (any player/season combo in player_game_stats not already in player_seasons)
    const existingPlayerSeasons = new Set();
    playerSeasons.forEach(ps => {
        existingPlayerSeasons.add(`${ps.player_id}_${ps.season_id}`);
    });

    let nextId = 0;
    playerSeasons.forEach(ps => {
        const id = parseInt(ps.id) || 0;
        if (id > nextId) nextId = id;
    });
    nextId++;

    let syntheticCount = 0;
    playerGameAppearances.forEach((appearances, playerId) => {
        // Group appearances by season
        const bySeason = new Map();
        appearances.forEach(a => {
            const sid = a.season_id;
            if (!bySeason.has(sid)) bySeason.set(sid, []);
            bySeason.get(sid).push(a);
        });

        bySeason.forEach((seasonApps, seasonId) => {
            const key = `${playerId}_${seasonId}`;
            if (existingPlayerSeasons.has(key)) return; // already exists

            const derivedTeamId = deriveTeamId(seasonApps);
            const tsId = derivedTeamId ? teamSeasonLookup.get(`${derivedTeamId}_${seasonId}`) : null;
            const player = playerMap.get(playerId);

            playerSeasons.push({
                id: nextId++,
                player_id: playerId,
                season_id: seasonId,
                team_id: derivedTeamId,
                team_season_id: tsId || null,
                jersey_number: null,
                position: player && player.position ? player.position.charAt(0) : 'F',
                position_name: player ? player.position : null,
                year: null,
                hometown: null,
                is_captain: 'N',
                games_played: seasonApps.length,
                goals: 0,
                assists: 0,
                points: 0,
                penalty_minutes: null,
                goals_against: 0,
                goals_against_average: 0,
                shots: 0,
                saves: 0,
                save_percentage: 0,
                shutouts: 0,
                minutes: 0,
                source_system: 'DERIVED'
            });
            syntheticCount++;
        });
    });
    console.log(`  Generated ${syntheticCount} synthetic player_seasons from game appearances`);
    console.log(`  Total player_seasons: ${playerSeasons.length}`);

    // --------------------------------------------------------
    // 3. Generate JSON data structures
    // --------------------------------------------------------

    // --- seasons.json ---
    console.log('\nGenerating seasons.json...');
    const seasonsJson = seasons.map(s => {
        // Extract start_year from start_date (first 4 chars), end_year from end_date
        const startYear = s.start_date ? parseInt(String(s.start_date).substring(0, 4), 10) : null;
        const endYear = s.end_date ? parseInt(String(s.end_date).substring(0, 4), 10) : null;

        return {
            id: String(s.id),
            name: s.name,
            display_name: seasonDisplayName(s.name),
            start_year: startYear,
            end_year: endYear
        };
    });

    // --- leagues.json ---
    console.log('Generating leagues.json...');
    const leaguesJson = leagues.map(l => ({
        id: String(l.id),
        name: l.name,
        short_name: l.short_name || null,
        gender: l.gender || 'M'
    }));

    // --- divisions.json ---
    console.log('Generating divisions.json...');
    const divisionsJson = divisions.map(d => ({
        id: String(d.id),
        name: d.name,
        gender: d.gender || 'M'
    }));

    // --- teams.json / team_seasons.json (same content, both files) ---
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
            season_name: season ? seasonDisplayName(season.name) : 'Unknown',
            league_id: ts.league_id ? String(ts.league_id) : null,
            league_name: league ? league.name : 'Independent',
            division_id: ts.division_id ? String(ts.division_id) : null,
            division_name: division ? division.name : null,
            gender: team ? (team.gender || 'M') : 'M',
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

    // --- games.json ---
    console.log('Generating games.json...');
    const gamesJson = games.map(g => {
        const homeTeam = teamMap.get(g.home_team_id);
        const awayTeam = teamMap.get(g.away_team_id);
        const season = seasonMap.get(g.season_id);
        const venue = g.venue_id ? venueMap.get(g.venue_id) : null;

        // Build timestamp from date + time
        let timestamp = null;
        if (g.game_date) {
            const timePart = g.game_time || '12:00:00';
            const d = new Date(`${g.game_date}T${timePart}`);
            if (!isNaN(d.getTime())) {
                timestamp = Math.floor(d.getTime() / 1000);
            }
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
            home_score: g.home_score != null ? g.home_score : 0,
            away_score: g.away_score != null ? g.away_score : 0,
            location_id: g.venue_id ? String(g.venue_id) : null,
            venue: venue ? venue.name : null,
            season_id: String(g.season_id),
            season_name: season ? seasonDisplayName(season.name) : 'Unknown',
            status: g.status || 'Final',
            game_type: g.game_type || 'Regular Season'
        };
    });

    // --- players.json (one entry per player_season) ---
    console.log('Generating players.json...');
    const playersJson = playerSeasons.map(ps => {
        const player = playerMap.get(ps.player_id);

        // Resolve team: use ps.team_id directly; fallback to team_season lookup
        let teamId = ps.team_id;
        if (!teamId && ps.team_season_id) {
            const ts = teamSeasonMap.get(ps.team_season_id);
            if (ts) teamId = ts.team_id;
        }
        const team = teamId ? teamMap.get(teamId) : null;

        // Resolve season: use ps.season_id directly; fallback to team_season lookup
        let seasonId = ps.season_id;
        if (!seasonId && ps.team_season_id) {
            const ts = teamSeasonMap.get(ps.team_season_id);
            if (ts) seasonId = ts.season_id;
        }
        const season = seasonId ? seasonMap.get(seasonId) : null;

        // Derive position name
        let positionName = ps.position_name;
        if (!positionName) {
            if (ps.position === 'G') positionName = 'Goalie';
            else if (ps.position === 'D') positionName = 'Defense';
            else positionName = 'Forward';
        }

        const goals = ps.goals || 0;
        const assists = ps.assists || 0;

        return {
            id: String(ps.id),
            player_id: String(ps.player_id),
            first_name: player ? player.first_name : '',
            last_name: player ? player.last_name : '',
            name: player ? `${player.first_name} ${player.last_name}` : '',
            position: positionName,
            captain: ps.is_captain || 'N',
            team_id: teamId ? String(teamId) : null,
            team_name: team ? team.name : 'Unknown',
            season_id: seasonId ? String(seasonId) : null,
            season_name: season ? seasonDisplayName(season.name) : 'Unknown',
            team_season_id: ps.team_season_id ? String(ps.team_season_id) : null,
            number: ps.jersey_number != null ? (parseInt(ps.jersey_number) || 0) : 0,
            year: ps.year || '',
            hometown: ps.hometown || '',
            goals: goals,
            assists: assists,
            points: ps.points != null ? ps.points : (goals + assists),
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

    // --- venues.json ---
    console.log('Generating venues.json...');
    const venuesJson = venues.map(v => ({
        id: String(v.id),
        name: v.name,
        address: v.address || '',
        city: v.city || '',
        state: v.state || '',
        zip: v.zip || ''
    }));

    // --- locations.json (backwards compat, same as venues) ---
    const locationsJson = venuesJson;

    // --- staff.json (one entry per staff_team) ---
    console.log('Generating staff.json...');
    const staffJson = staffTeams.map(st => {
        const person = staffMap.get(st.staff_id);
        const team = teamMap.get(st.team_id);

        return {
            staff_id: String(st.staff_id),
            first_name: person ? person.first_name : '',
            last_name: person ? person.last_name : '',
            name: person ? `${person.first_name} ${person.last_name}` : '',
            role: person ? (person.role || 'Coach') : 'Coach',
            team_id: String(st.team_id),
            team_name: team ? team.name : 'Unknown',
            team_gender: team ? (team.gender || 'M') : 'M'
        };
    });

    // --------------------------------------------------------
    // 4. Write output files
    // --------------------------------------------------------
    console.log('\nWriting output files...');

    // Ensure output directories exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const seasonsDir = path.join(OUTPUT_DIR, 'seasons');
    if (!fs.existsSync(seasonsDir)) {
        fs.mkdirSync(seasonsDir, { recursive: true });
    }

    // Write each JSON file
    const writeJson = (filename, data) => {
        fs.writeFileSync(
            path.join(OUTPUT_DIR, filename),
            JSON.stringify(data, null, 2)
        );
        console.log(`  Written ${filename} (${data.length} records)`);
    };

    writeJson('seasons.json', seasonsJson);
    writeJson('leagues.json', leaguesJson);
    writeJson('divisions.json', divisionsJson);
    writeJson('teams.json', teamSeasonsJson);
    writeJson('team_seasons.json', teamSeasonsJson);
    writeJson('games.json', gamesJson);
    writeJson('players.json', playersJson);
    writeJson('venues.json', venuesJson);
    writeJson('locations.json', locationsJson);
    writeJson('staff.json', staffJson);

    // --------------------------------------------------------
    // 5. Generate per-season files in data/seasons/N.json
    // --------------------------------------------------------
    console.log('\nGenerating season-specific files...');

    for (const season of seasons) {
        const sid = String(season.id);
        const seasonTeams = teamSeasonsJson.filter(t => t.season_id === sid);
        const seasonGames = gamesJson.filter(g => g.season_id === sid);
        const seasonPlayers = playersJson.filter(p => p.season_id === sid);

        const seasonData = {
            id: sid,
            name: season.name,
            display_name: seasonDisplayName(season.name),
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

    // --------------------------------------------------------
    // Summary
    // --------------------------------------------------------
    console.log('\n========================================');
    console.log('MERGE COMPLETE!');
    console.log('========================================');
    console.log(`Seasons:      ${seasonsJson.length}`);
    console.log(`Leagues:      ${leaguesJson.length}`);
    console.log(`Divisions:    ${divisionsJson.length}`);
    console.log(`Team Seasons: ${teamSeasonsJson.length}`);
    console.log(`Games:        ${gamesJson.length}`);
    console.log(`Players:      ${playersJson.length}`);
    console.log(`Venues:       ${venuesJson.length}`);
    console.log(`Staff:        ${staffJson.length}`);
    console.log('========================================\n');
}

// Run the merge
mergeData().catch(err => {
    console.error('Error during merge:', err);
    process.exit(1);
});
