/**
 * MassHSHockey Data Merge Script
 * Parses SQL INSERT statements from output_v2 and generates updated JSON files
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = './output_final';
const OUTPUT_DIR = './data';

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

// Main merge function
async function mergeData() {
    console.log('Starting data merge...\n');

    // 1. Parse all reference tables
    console.log('Parsing seasons...');
    const seasonsSQL = readSQLFile('insert_seasons.sql');
    const seasons = parseSQLInserts(seasonsSQL, 'seasons');
    console.log(`  Found ${seasons.length} seasons`);

    console.log('Parsing leagues...');
    const leaguesSQL = readSQLFile('insert_leagues.sql');
    const leagues = parseSQLInserts(leaguesSQL, 'leagues');
    console.log(`  Found ${leagues.length} leagues`);

    console.log('Parsing divisions...');
    const divisionsSQL = readSQLFile('insert_divisions.sql');
    const divisions = parseSQLInserts(divisionsSQL, 'divisions');
    console.log(`  Found ${divisions.length} divisions`);

    console.log('Parsing venues...');
    const venuesSQL = readSQLFile('insert_venues.sql');
    const venues = parseSQLInserts(venuesSQL, 'venues');
    console.log(`  Found ${venues.length} venues`);

    console.log('Parsing schools...');
    const schoolsSQL = readSQLFile('insert_schools.sql');
    const schools = schoolsSQL ? parseSQLInserts(schoolsSQL, 'schools') : [];
    console.log(`  Found ${schools.length} schools`);

    console.log('Parsing teams...');
    const teamsSQL = readSQLFile('insert_teams.sql');
    const teams = parseSQLInserts(teamsSQL, 'teams');
    console.log(`  Found ${teams.length} teams`);

    console.log('Parsing team_seasons...');
    const teamSeasonsSQL = readSQLFile('insert_team_seasons.sql');
    const teamSeasons = parseSQLInserts(teamSeasonsSQL, 'team_seasons');
    console.log(`  Found ${teamSeasons.length} team_seasons`);

    console.log('Parsing games...');
    const gamesSQL = readSQLFile('insert_games.sql');
    const games = parseSQLInserts(gamesSQL, 'games');
    console.log(`  Found ${games.length} games`);

    console.log('Parsing players...');
    const playersSQL = readSQLFile('insert_players.sql');
    const players = playersSQL ? parseSQLInserts(playersSQL, 'players') : [];
    console.log(`  Found ${players.length} players`);

    // Try to load additional player files if they exist (for split data)
    const players2SQL = readSQLFile('insert_players_2019_2023.sql');
    const players2 = players2SQL ? parseSQLInserts(players2SQL, 'players') : [];
    if (players2.length > 0) {
        console.log(`  Found ${players2.length} additional players (2019-2023)`);
    }

    console.log('Parsing player_seasons...');
    const playerSeasonsSQL = readSQLFile('insert_player_seasons.sql');
    const playerSeasons = playerSeasonsSQL ? parseSQLInserts(playerSeasonsSQL, 'player_seasons') : [];
    console.log(`  Found ${playerSeasons.length} player_seasons`);

    // Try to load additional player_seasons if they exist
    const playerSeasons2SQL = readSQLFile('insert_player_seasons_2019_2023.sql');
    const playerSeasons2 = playerSeasons2SQL ? parseSQLInserts(playerSeasons2SQL, 'player_seasons') : [];
    if (playerSeasons2.length > 0) {
        console.log(`  Found ${playerSeasons2.length} additional player_seasons (2019-2023)`);
    }

    // Combine players and player_seasons
    const allPlayers = [...players, ...players2];
    const allPlayerSeasons = [...playerSeasons, ...playerSeasons2];

    // 2. Build lookup maps
    console.log('\nBuilding lookup maps...');

    const seasonMap = new Map(seasons.map(s => [s.id, s]));
    const leagueMap = new Map(leagues.map(l => [l.id, l]));
    const divisionMap = new Map(divisions.map(d => [d.id, d]));
    const venueMap = new Map(venues.map(v => [v.id, v]));
    const schoolMap = new Map(schools.map(s => [s.id, s]));
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const teamSeasonMap = new Map(teamSeasons.map(ts => [ts.id, ts]));
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));

    // 3. Generate seasons.json
    console.log('\nGenerating seasons.json...');
    const seasonsJson = seasons.map(s => ({
        id: String(s.id),
        legacy_id: s.legacy_id ? String(s.legacy_id) : null,
        name: s.name,
        display_name: `${s.name} Season`,
        start_year: s.start_year,
        end_year: s.end_year
    }));

    // 4. Generate leagues.json
    console.log('Generating leagues.json...');
    const leaguesJson = leagues.map(l => ({
        id: String(l.id),
        legacy_id: l.legacy_id ? String(l.legacy_id) : null,
        name: l.name,
        short_name: l.short_name,
        gender: l.gender || 'M'
    }));

    // 5. Generate team_seasons.json (main teams file)
    console.log('Generating team_seasons.json...');
    const teamSeasonsJson = teamSeasons.map(ts => {
        const team = teamMap.get(ts.team_id);
        const season = seasonMap.get(ts.season_id);
        const league = ts.league_id ? leagueMap.get(ts.league_id) : null;
        const division = ts.division_id ? divisionMap.get(ts.division_id) : null;
        const school = team ? schoolMap.get(team.school_id) : null;

        return {
            id: String(ts.id),
            team_id: String(ts.team_id),
            team_name: team ? team.name : 'Unknown',
            season_id: String(ts.season_id),
            season_name: season ? season.name.includes('Season') ? season.name : `${season.name} Season` : 'Unknown',
            league_id: ts.league_id ? String(ts.league_id) : null,
            league_name: league ? league.name : 'Independent',
            division_id: ts.division_id ? String(ts.division_id) : null,
            division_name: division ? division.name : null,
            division_section_id: null,
            division_section_name: null,
            gender: team ? team.gender : 'M',
            overall: {
                wins: ts.wins || 0,
                losses: ts.losses || 0,
                ties: ts.ties || 0,
                goals_for: ts.goals_for || 0,
                goals_against: ts.goals_against || 0,
                points: ts.points || 0,
                win_pct: ts.win_pct || 0
            },
            league: {
                wins: ts.league_wins || 0,
                losses: ts.league_losses || 0,
                ties: ts.league_ties || 0,
                goals_for: ts.league_goals_for || 0,
                goals_against: ts.league_goals_against || 0,
                points: ts.league_points || 0,
                win_pct: ts.league_win_pct || 0
            },
            qualifying: {
                wins: ts.qual_wins || 0,
                losses: ts.qual_losses || 0,
                ties: ts.qual_ties || 0,
                goals_for: ts.qual_goals_for || 0,
                goals_against: ts.qual_goals_against || 0,
                points: ts.qual_points || 0,
                win_pct: ts.qual_win_pct || 0
            },
            tournament: {
                wins: ts.tourn_wins || 0,
                losses: ts.tourn_losses || 0,
                ties: ts.tourn_ties || 0,
                goals_for: ts.tourn_goals_for || 0,
                goals_against: ts.tourn_goals_against || 0,
                points: 0,
                win_pct: 0
            }
        };
    });

    // 6. Generate games.json
    console.log('Generating games.json...');
    const gamesJson = games.map(g => {
        const homeTeam = teamMap.get(g.home_team_id);
        const awayTeam = teamMap.get(g.away_team_id);
        const season = seasonMap.get(g.season_id);
        const venue = g.venue_id ? venueMap.get(g.venue_id) : null;

        // Convert date to timestamp
        let timestamp = null;
        if (g.game_date) {
            const d = new Date(g.game_date + 'T12:00:00');
            timestamp = Math.floor(d.getTime() / 1000);
        }

        return {
            id: String(g.id),
            date: g.game_date,
            timestamp: timestamp,
            home_team_id: String(g.home_team_id),
            away_team_id: String(g.away_team_id),
            home_team: homeTeam ? homeTeam.name : 'Unknown',
            away_team: awayTeam ? awayTeam.name : 'Unknown',
            home_score: g.home_score,
            away_score: g.away_score,
            location_id: g.venue_id ? String(g.venue_id) : null,
            venue: venue ? venue.name : null,
            event_desc: g.event_desc,
            season_id: String(g.season_id),
            season_name: season ? season.name.includes('Season') ? season.name : `${season.name} Season` : 'Unknown',
            home_team_season_id: g.home_team_season_id ? String(g.home_team_season_id) : null,
            away_team_season_id: g.away_team_season_id ? String(g.away_team_season_id) : null,
            status: String(g.status || 1),
            do_not_include_in_record: g.counts_for_record === false ? 1 : 0,
            exempt_home_team: g.exempt_home ? 1 : 0,
            exempt_visit_team: g.exempt_away ? 1 : 0
        };
    });

    // 7. Generate players.json
    console.log('Generating players.json...');
    const playersJson = allPlayerSeasons.map(ps => {
        const player = playerMap.get(ps.player_id);
        const teamSeason = teamSeasonMap.get(ps.team_season_id);
        const team = teamSeason ? teamMap.get(teamSeason.team_id) : null;
        const season = teamSeason ? seasonMap.get(teamSeason.season_id) : null;

        return {
            id: String(ps.id),
            first_name: player ? player.first_name : '',
            last_name: player ? player.last_name : '',
            name: player ? `${player.first_name} ${player.last_name}` : '',
            position: ps.position_name || (ps.position === 'G' ? 'Goalie' : 'Forward'),
            captain: ps.is_captain || 'N',
            team_id: team ? String(teamSeason.team_id) : null,
            team_name: team ? team.name : 'Unknown',
            season_id: season ? String(teamSeason.season_id) : null,
            season_name: season ? season.name.includes('Season') ? season.name : `${season.name} Season` : 'Unknown',
            team_season_id: String(ps.team_season_id),
            number: ps.jersey_number ? parseInt(ps.jersey_number) || 0 : 0,
            year: ps.year || '',
            hometown: ps.hometown || '',
            goals: ps.goals || 0,
            assists: ps.assists || 0,
            points: (ps.goals || 0) + (ps.assists || 0),
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

    // 8. Write output files
    console.log('\nWriting output files...');

    // Backup existing files
    const backupDir = path.join(OUTPUT_DIR, 'backup_' + Date.now());
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const filesToBackup = ['teams.json', 'games.json', 'players.json', 'team_seasons.json', 'leagues.json'];
    filesToBackup.forEach(f => {
        const src = path.join(OUTPUT_DIR, f);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(backupDir, f));
        }
    });
    console.log(`  Backed up existing files to ${backupDir}`);

    // Write new files
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'seasons.json'),
        JSON.stringify(seasonsJson, null, 2)
    );
    console.log(`  Written seasons.json (${seasonsJson.length} records)`);

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'leagues.json'),
        JSON.stringify(leaguesJson, null, 2)
    );
    console.log(`  Written leagues.json (${leaguesJson.length} records)`);

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'teams.json'),
        JSON.stringify(teamSeasonsJson, null, 2)
    );
    console.log(`  Written teams.json (${teamSeasonsJson.length} records)`);

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'team_seasons.json'),
        JSON.stringify(teamSeasonsJson, null, 2)
    );
    console.log(`  Written team_seasons.json (${teamSeasonsJson.length} records)`);

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'games.json'),
        JSON.stringify(gamesJson, null, 2)
    );
    console.log(`  Written games.json (${gamesJson.length} records)`);

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'players.json'),
        JSON.stringify(playersJson, null, 2)
    );
    console.log(`  Written players.json (${playersJson.length} records)`);

    // Write venues (new file)
    const venuesJson = venues.map(v => ({
        id: String(v.id),
        name: v.name,
        city: v.city,
        address: v.address
    }));
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'venues.json'),
        JSON.stringify(venuesJson, null, 2)
    );
    console.log(`  Written venues.json (${venuesJson.length} records)`);

    // Generate season-specific files
    console.log('\nGenerating season-specific files...');
    const seasonsDir = path.join(OUTPUT_DIR, 'seasons');
    if (!fs.existsSync(seasonsDir)) {
        fs.mkdirSync(seasonsDir, { recursive: true });
    }

    for (const season of seasons) {
        const seasonTeams = teamSeasonsJson.filter(t => t.season_id === String(season.id));
        const seasonGames = gamesJson.filter(g => g.season_id === String(season.id));
        const seasonPlayers = playersJson.filter(p => p.season_id === String(season.id));

        const seasonData = {
            id: String(season.id),
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
    console.log(`Team Seasons: ${teamSeasonsJson.length}`);
    console.log(`Games: ${gamesJson.length}`);
    console.log(`Players: ${playersJson.length}`);
    console.log(`Venues: ${venuesJson.length}`);
    console.log('========================================\n');
}

// Run the merge
mergeData().catch(err => {
    console.error('Error during merge:', err);
    process.exit(1);
});
