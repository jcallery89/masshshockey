<?php
/**
 * Mass HS Hockey - Data API
 *
 * Connects to the masshshockey database (unified schema) and returns data as JSON
 * This is a read-only API for public viewing of historical data (2008-2023)
 *
 * Updated for new unified database schema - see MASSHSHOCKEY_WEB_APP_PRD.md
 * Field names aliased to match frontend app.js expectations
 */

// Database configuration
// IMPORTANT: Update these values for your database setup
define('DB_HOST', 'localhost');
define('DB_NAME', 'masshshockey');           // New unified database
define('DB_USER', 'your_username');          // Change this
define('DB_PASS', 'your_password');          // Change this
define('DB_CHARSET', 'utf8mb4');

// Error handling
error_reporting(0);  // Hide errors from public
ini_set('display_errors', 0);

// Set JSON headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');  // Allow CORS for development

// Connect to database
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }
}

// Main execution
try {
    $db = getDBConnection();

    // Fetch all data
    $data = [
        'seasons' => getSeasons($db),
        'leagues' => getLeagues($db),
        'divisions' => getDivisions($db),
        'teams' => getTeams($db),
        'games' => getGames($db),
        'players' => getPlayers($db),
        'staff' => getStaff($db)
    ];

    echo json_encode($data, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to retrieve data']);
}

/**
 * Get all seasons (15 seasons: 2008-2023)
 * Season IDs 1-15 map to 2008-2009 through 2022-2023
 */
function getSeasons($db) {
    try {
        $stmt = $db->query("
            SELECT
                id,
                name,
                start_date,
                end_date
            FROM seasons
            ORDER BY id DESC
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching seasons: " . $e->getMessage());
        return [];
    }
}

/**
 * Get all leagues (249 records)
 * Now includes gender column (M, W, or NULL)
 * League names no longer include "(W)" suffix
 */
function getLeagues($db) {
    try {
        $stmt = $db->query("
            SELECT
                id,
                name,
                short_name,
                gender
            FROM leagues
            ORDER BY name
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching leagues: " . $e->getMessage());
        return [];
    }
}

/**
 * Get all divisions (6 records: Division 1-6)
 */
function getDivisions($db) {
    try {
        $stmt = $db->query("
            SELECT
                id,
                name
            FROM divisions
            ORDER BY id
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching divisions: " . $e->getMessage());
        return [];
    }
}

/**
 * Get teams with their seasonal records
 * Joins teams with team_seasons for standings data
 * Field names aliased to match app.js expectations:
 *   - id = team_season_id (primary identifier for team+season combo)
 *   - team_id = teams.id
 *   - team_name = teams.name
 *   - season_name = seasons.name
 *   - league_name = leagues.name
 *   - division_name = divisions.name
 */
function getTeams($db) {
    try {
        $stmt = $db->query("
            SELECT
                ts.id as id,
                t.id as team_id,
                t.name as team_name,
                t.gender,
                ts.season_id,
                s.name as season_name,
                ts.league_id,
                l.name as league_name,
                l.short_name as league_short,
                ts.division_id,
                d.name as division_name,
                ts.wins,
                ts.losses,
                ts.ties,
                ts.points,
                ts.goals_for,
                ts.goals_against,
                ts.win_pct
            FROM team_seasons ts
            JOIN teams t ON ts.team_id = t.id
            JOIN seasons s ON ts.season_id = s.id
            LEFT JOIN leagues l ON ts.league_id = l.id
            LEFT JOIN divisions d ON ts.division_id = d.id
            ORDER BY t.name, ts.season_id DESC
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching teams: " . $e->getMessage());
        return [];
    }
}

/**
 * Get all games (44,818 records)
 * Returns games with home/away team names joined
 * Includes team_season_ids for filtering by team in app.js
 */
function getGames($db) {
    try {
        $stmt = $db->query("
            SELECT
                g.id,
                g.season_id,
                s.name as season_name,
                g.game_date as date,
                g.home_team_id,
                ht.name as home_team,
                ht.gender as home_team_gender,
                hts.id as home_team_season_id,
                g.home_score,
                g.away_team_id,
                at.name as away_team,
                at.gender as away_team_gender,
                ats.id as away_team_season_id,
                g.away_score,
                g.venue,
                UNIX_TIMESTAMP(g.game_date) as timestamp
            FROM games g
            JOIN seasons s ON g.season_id = s.id
            JOIN teams ht ON g.home_team_id = ht.id
            JOIN teams at ON g.away_team_id = at.id
            LEFT JOIN team_seasons hts ON hts.team_id = g.home_team_id AND hts.season_id = g.season_id
            LEFT JOIN team_seasons ats ON ats.team_id = g.away_team_id AND ats.season_id = g.season_id
            ORDER BY g.game_date DESC, g.id DESC
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching games: " . $e->getMessage());
        return [];
    }
}

/**
 * Get player statistics (59,880 player_seasons records)
 * Joins players with player_seasons for stats
 * Field names aliased to match app.js expectations:
 *   - id = player_season_id
 *   - name = full name
 *   - team_name = team name
 *   - season_name = season name
 *   - number = jersey_number
 *   - position = position code or position_name for display
 */
function getPlayers($db) {
    try {
        $stmt = $db->query("
            SELECT
                ps.id as id,
                p.id as player_id,
                p.first_name,
                p.last_name,
                CONCAT(p.first_name, ' ', p.last_name) as name,
                ps.team_id,
                t.name as team_name,
                t.gender as team_gender,
                ps.season_id,
                s.name as season_name,
                ps.team_season_id,
                ps.jersey_number as number,
                CASE
                    WHEN ps.position = 'G' THEN 'Goalie'
                    WHEN ps.position = 'F' THEN 'Forward'
                    WHEN ps.position = 'D' THEN 'Defense'
                    ELSE COALESCE(ps.position_name, ps.position, '-')
                END as position,
                ps.year,
                ps.hometown,
                ps.is_captain,
                ps.games_played,
                ps.goals,
                ps.assists,
                (COALESCE(ps.goals, 0) + COALESCE(ps.assists, 0)) as points,
                ps.penalty_minutes,
                ps.goals_against,
                ps.goals_against_average,
                ps.saves,
                ps.shots,
                ps.save_percentage,
                ps.shutouts,
                ps.minutes
            FROM player_seasons ps
            JOIN players p ON ps.player_id = p.id
            JOIN teams t ON ps.team_id = t.id
            JOIN seasons s ON ps.season_id = s.id
            ORDER BY points DESC, ps.goals DESC, p.last_name, p.first_name
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching players: " . $e->getMessage());
        return [];
    }
}

/**
 * Get staff (coaches) with their team assignments
 * 1,208 staff records, 1,215 team assignments
 */
function getStaff($db) {
    try {
        $stmt = $db->query("
            SELECT
                s.id as staff_id,
                s.first_name,
                s.last_name,
                CONCAT(s.first_name, ' ', s.last_name) as name,
                s.role,
                st.team_id,
                t.name as team_name,
                t.gender as team_gender
            FROM staff s
            JOIN staff_teams st ON s.id = st.staff_id
            JOIN teams t ON st.team_id = t.id
            ORDER BY s.last_name, s.first_name
        ");
        return $stmt->fetchAll();
    } catch (Exception $e) {
        error_log("Error fetching staff: " . $e->getMessage());
        return [];
    }
}
?>
