// Data Loader - Configurable data loading system
// Supports: DEMO mode (sample data), JSON files, or PHP API
// Updated for new unified database schema (2008-2023)

const DATA_CONFIG = {
    // Change this to switch data sources
    // Options: 'DEMO', 'JSON', 'API'
    mode: 'JSON',

    // For JSON mode: path to JSON data files
    jsonPath: './data/',

    // For API mode: path to PHP backend
    apiPath: './api.php'
};

// Sample data for DEMO mode - matches new unified schema structure
const SAMPLE_DATA = {
    seasons: [
        { id: '15', name: '2022-2023 Season' },
        { id: '14', name: '2021-2022 Season' },
        { id: '13', name: '2020-2021 Season' }
    ],

    leagues: [
        { id: '1', name: 'Catholic Conference', short_name: 'CC', gender: 'M' },
        { id: '2', name: 'Dual County League', short_name: 'DCL', gender: 'M' },
        { id: '3', name: 'Bay State Conference', short_name: 'BSC', gender: 'M' },
        { id: '4', name: 'Merrimack Valley Conference', short_name: 'MVC', gender: 'M' }
    ],

    divisions: [
        { id: '1', name: 'Division 1' },
        { id: '2', name: 'Division 2' },
        { id: '3', name: 'Division 3' }
    ],

    teams: [
        {
            id: '1',
            team_id: '1',
            team_name: 'BC High',
            gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            league_id: '1',
            league_name: 'Catholic Conference',
            division_id: '1',
            division_name: 'Division 1',
            wins: 18,
            losses: 4,
            ties: 2,
            points: 38,
            goals_for: 85,
            goals_against: 42,
            win_pct: 0.792
        },
        {
            id: '2',
            team_id: '2',
            team_name: 'Catholic Memorial',
            gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            league_id: '1',
            league_name: 'Catholic Conference',
            division_id: '1',
            division_name: 'Division 1',
            wins: 16,
            losses: 6,
            ties: 1,
            points: 33,
            goals_for: 72,
            goals_against: 45,
            win_pct: 0.717
        },
        {
            id: '3',
            team_id: '3',
            team_name: 'Malden Catholic',
            gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            league_id: '1',
            league_name: 'Catholic Conference',
            division_id: '1',
            division_name: 'Division 1',
            wins: 15,
            losses: 7,
            ties: 2,
            points: 32,
            goals_for: 68,
            goals_against: 50,
            win_pct: 0.667
        },
        {
            id: '4',
            team_id: '4',
            team_name: 'St. Johns Prep',
            gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            league_id: '1',
            league_name: 'Catholic Conference',
            division_id: '1',
            division_name: 'Division 1',
            wins: 14,
            losses: 8,
            ties: 1,
            points: 29,
            goals_for: 65,
            goals_against: 52,
            win_pct: 0.630
        },
        {
            id: '5',
            team_id: '5',
            team_name: 'Wellesley',
            gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            league_id: '2',
            league_name: 'Dual County League',
            division_id: '2',
            division_name: 'Division 2',
            wins: 20,
            losses: 2,
            ties: 0,
            points: 40,
            goals_for: 95,
            goals_against: 35,
            win_pct: 0.909
        }
    ],

    games: [
        {
            id: '1',
            season_id: '15',
            season_name: '2022-2023 Season',
            date: '2023-01-15',
            home_team_id: '1',
            home_team: 'BC High',
            home_team_gender: 'M',
            home_team_season_id: '1',
            home_score: 4,
            away_team_id: '2',
            away_team: 'Catholic Memorial',
            away_team_gender: 'M',
            away_team_season_id: '2',
            away_score: 2,
            venue: 'Warrior Ice Arena',
            timestamp: 1673740800
        },
        {
            id: '2',
            season_id: '15',
            season_name: '2022-2023 Season',
            date: '2023-01-18',
            home_team_id: '3',
            home_team: 'Malden Catholic',
            home_team_gender: 'M',
            home_team_season_id: '3',
            home_score: 3,
            away_team_id: '4',
            away_team: 'St. Johns Prep',
            away_team_gender: 'M',
            away_team_season_id: '4',
            away_score: 3,
            venue: 'Stoneham Arena',
            timestamp: 1674000000
        }
    ],

    players: [
        {
            id: '1',
            player_id: '1',
            first_name: 'Jack',
            last_name: 'Thompson',
            name: 'Jack Thompson',
            team_id: '1',
            team_name: 'BC High',
            team_gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            number: '17',
            position: 'Forward',
            year: 'SR',
            hometown: 'Boston',
            goals: 28,
            assists: 32,
            points: 60,
            games_played: 24,
            penalty_minutes: 12
        },
        {
            id: '2',
            player_id: '2',
            first_name: 'Mike',
            last_name: 'Sullivan',
            name: 'Mike Sullivan',
            team_id: '1',
            team_name: 'BC High',
            team_gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            number: '4',
            position: 'Defense',
            year: 'JR',
            hometown: 'Quincy',
            goals: 8,
            assists: 22,
            points: 30,
            games_played: 24,
            penalty_minutes: 18
        },
        {
            id: '3',
            player_id: '3',
            first_name: 'Tom',
            last_name: 'Brady',
            name: 'Tom Brady',
            team_id: '1',
            team_name: 'BC High',
            team_gender: 'M',
            season_id: '15',
            season_name: '2022-2023 Season',
            number: '30',
            position: 'Goalie',
            year: 'SR',
            hometown: 'Dorchester',
            goals: 0,
            assists: 0,
            points: 0,
            games_played: 22,
            goals_against: 42,
            goals_against_average: 1.91,
            saves: 520,
            shots: 562,
            save_percentage: 0.925,
            shutouts: 4
        }
    ],

    staff: [
        {
            staff_id: '1',
            first_name: 'John',
            last_name: 'Smith',
            name: 'John Smith',
            role: 'Coach',
            team_id: '1',
            team_name: 'BC High',
            team_gender: 'M'
        }
    ]
};

// Main data loading function
async function loadHockeyData() {
    console.log(`Loading data in ${DATA_CONFIG.mode} mode...`);

    switch(DATA_CONFIG.mode) {
        case 'DEMO':
            return loadDemoData();
        case 'JSON':
            return loadFromJSON();
        case 'API':
            return loadFromAPI();
        default:
            throw new Error('Invalid data mode configured');
    }
}

// Load demo data (immediate)
function loadDemoData() {
    console.log('Using sample data for demo');
    return Promise.resolve(SAMPLE_DATA);
}

// Load from JSON files
async function loadFromJSON() {
    try {
        const [teams, games, players, leagues, divisions, seasons, locations] = await Promise.all([
            fetch(`${DATA_CONFIG.jsonPath}team_seasons.json`).then(r => r.json()),
            fetch(`${DATA_CONFIG.jsonPath}games.json`).then(r => r.json()),
            fetch(`${DATA_CONFIG.jsonPath}players.json`).then(r => r.json()),
            fetch(`${DATA_CONFIG.jsonPath}leagues.json`).then(r => r.json()),
            fetch(`${DATA_CONFIG.jsonPath}divisions.json`).then(r => r.json()),
            fetch(`${DATA_CONFIG.jsonPath}seasons.json`).then(r => r.json()),
            fetch(`${DATA_CONFIG.jsonPath}locations.json`).then(r => r.json()).catch(() => [])
        ]);

        return { teams, games, players, leagues, divisions, seasons, locations, staff: [] };
    } catch (error) {
        console.error('Failed to load JSON data:', error);
        throw new Error('Could not load JSON data files');
    }
}

// Load from PHP API
async function loadFromAPI() {
    try {
        const response = await fetch(DATA_CONFIG.apiPath);

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (!data || typeof data !== 'object') {
            throw new Error('Invalid API response');
        }

        // Ensure all expected properties exist
        return {
            seasons: data.seasons || [],
            leagues: data.leagues || [],
            divisions: data.divisions || [],
            teams: data.teams || [],
            games: data.games || [],
            players: data.players || [],
            staff: data.staff || []
        };
    } catch (error) {
        console.error('Failed to load from API:', error);
        throw new Error('Could not connect to database API');
    }
}

// Export configuration so users can modify it easily
if (typeof window !== 'undefined') {
    window.DATA_CONFIG = DATA_CONFIG;
}
