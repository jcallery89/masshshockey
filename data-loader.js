// Data Loader - Configurable data loading system
// Supports: DEMO mode (sample data), JSON files, or PHP API

const DATA_CONFIG = {
    // Change this to switch data sources
    // Options: 'DEMO', 'JSON', 'API'
    mode: 'JSON',

    // For JSON mode: path to JSON data files
    jsonPath: './data/',

    // For API mode: path to PHP backend
    apiPath: './api.php'
};

// Sample data for DEMO mode
const SAMPLE_DATA = {
    seasons: [
        { id: '1', name: '2009-2010' },
        { id: '2', name: '2010-2011' },
        { id: '3', name: '2011-2012' }
    ],

    leagues: [
        { id: '1', name: 'Catholic Conference' },
        { id: '2', name: 'Dual County League' },
        { id: '3', name: 'Bay State Conference' },
        { id: '4', name: 'Merrimack Valley Conference' }
    ],

    divisions: [
        { id: '1', name: 'Division 1' },
        { id: '2', name: 'Division 2' },
        { id: '3', name: 'Division 3' },
        { id: '4', name: 'Large' },
        { id: '5', name: 'Small' }
    ],

    teams: [
        {
            id: '1',
            name: 'BC High',
            season_id: '1',
            league_id: '1',
            league: 'Catholic Conference',
            division_id: '1',
            division: 'Division 1',
            wins: 18,
            losses: 4,
            ties: 2,
            coach: 'John Smith',
            venue: 'Warrior Ice Arena'
        },
        {
            id: '2',
            name: 'Catholic Memorial',
            season_id: '1',
            league_id: '1',
            league: 'Catholic Conference',
            division_id: '1',
            division: 'Division 1',
            wins: 16,
            losses: 6,
            ties: 1,
            coach: 'Mike Johnson',
            venue: 'Asiaf Arena'
        },
        {
            id: '3',
            name: 'Malden Catholic',
            season_id: '1',
            league_id: '1',
            league: 'Catholic Conference',
            division_id: '1',
            division: 'Division 1',
            wins: 15,
            losses: 7,
            ties: 2,
            coach: 'Chris Brown',
            venue: 'Stoneham Arena'
        },
        {
            id: '4',
            name: 'St. Johns Prep',
            season_id: '1',
            league_id: '1',
            league: 'Catholic Conference',
            division_id: '1',
            division: 'Division 1',
            wins: 14,
            losses: 8,
            ties: 1,
            coach: 'Tom Wilson',
            venue: 'Essex Sports Center'
        },
        {
            id: '5',
            name: 'Wellesley',
            season_id: '1',
            league_id: '2',
            league: 'Dual County League',
            division_id: '4',
            division: 'Large',
            wins: 20,
            losses: 2,
            ties: 0,
            coach: 'Dave Anderson',
            venue: 'Babson Skating Center'
        },
        {
            id: '6',
            name: 'Waltham',
            season_id: '1',
            league_id: '2',
            league: 'Dual County League',
            division_id: '4',
            division: 'Large',
            wins: 12,
            losses: 9,
            ties: 1,
            coach: 'Steve Davis',
            venue: 'Veterans Memorial Rink'
        },
        {
            id: '7',
            name: 'Newton South',
            season_id: '1',
            league_id: '3',
            league: 'Bay State Conference',
            division_id: '2',
            division: 'Division 2',
            wins: 13,
            losses: 8,
            ties: 3,
            coach: 'Paul Miller',
            venue: 'Newton Centre Rink'
        },
        {
            id: '8',
            name: 'Needham',
            season_id: '1',
            league_id: '3',
            league: 'Bay State Conference',
            division_id: '2',
            division: 'Division 2',
            wins: 11,
            losses: 10,
            ties: 2,
            coach: 'Mark Taylor',
            venue: 'Chase Rink'
        },
        {
            id: '9',
            name: 'Billerica',
            season_id: '1',
            league_id: '4',
            league: 'Merrimack Valley Conference',
            division_id: '2',
            division: 'Division 2',
            wins: 14,
            losses: 7,
            ties: 1,
            coach: 'Jim Harris',
            venue: 'Chelmsford Forum'
        },
        {
            id: '10',
            name: 'Reading',
            season_id: '1',
            league_id: '4',
            league: 'Merrimack Valley Conference',
            division_id: '2',
            division: 'Division 2',
            wins: 10,
            losses: 11,
            ties: 1,
            coach: 'Bob Martin',
            venue: 'Burbank Ice Arena'
        }
    ],

    games: [
        {
            id: '1',
            date: '2010-01-15',
            home_team: 'BC High',
            away_team: 'Catholic Memorial',
            home_score: 4,
            away_score: 2,
            venue: 'Warrior Ice Arena',
            season_id: '1'
        },
        {
            id: '2',
            date: '2010-01-18',
            home_team: 'Malden Catholic',
            away_team: 'St. Johns Prep',
            home_score: 3,
            away_score: 3,
            venue: 'Stoneham Arena',
            season_id: '1'
        },
        {
            id: '3',
            date: '2010-01-20',
            home_team: 'Wellesley',
            away_team: 'Waltham',
            home_score: 5,
            away_score: 1,
            venue: 'Babson Skating Center',
            season_id: '1'
        },
        {
            id: '4',
            date: '2010-01-22',
            home_team: 'Newton South',
            away_team: 'Needham',
            home_score: 2,
            away_score: 2,
            venue: 'Newton Centre Rink',
            season_id: '1'
        },
        {
            id: '5',
            date: '2010-01-25',
            home_team: 'Billerica',
            away_team: 'Reading',
            home_score: 4,
            away_score: 3,
            venue: 'Chelmsford Forum',
            season_id: '1'
        },
        {
            id: '6',
            date: '2010-02-01',
            home_team: 'Catholic Memorial',
            away_team: 'Malden Catholic',
            home_score: 5,
            away_score: 2,
            venue: 'Asiaf Arena',
            season_id: '1'
        },
        {
            id: '7',
            date: '2010-02-05',
            home_team: 'St. Johns Prep',
            away_team: 'BC High',
            home_score: 2,
            away_score: 4,
            venue: 'Essex Sports Center',
            season_id: '1'
        },
        {
            id: '8',
            date: '2010-02-08',
            home_team: 'Waltham',
            away_team: 'Newton South',
            home_score: 3,
            away_score: 4,
            venue: 'Veterans Memorial Rink',
            season_id: '1'
        },
        {
            id: '9',
            date: '2010-02-12',
            home_team: 'Needham',
            away_team: 'Wellesley',
            home_score: 1,
            away_score: 6,
            venue: 'Chase Rink',
            season_id: '1'
        },
        {
            id: '10',
            date: '2010-02-15',
            home_team: 'Reading',
            away_team: 'Billerica',
            home_score: 2,
            away_score: 3,
            venue: 'Burbank Ice Arena',
            season_id: '1'
        }
    ],

    players: [
        {
            id: '1',
            name: 'Jack Thompson',
            team: 'BC High',
            position: 'Forward',
            goals: 28,
            assists: 32,
            points: 60,
            season_id: '1'
        },
        {
            id: '2',
            name: 'Mike Sullivan',
            team: 'BC High',
            position: 'Defense',
            goals: 8,
            assists: 22,
            points: 30,
            season_id: '1'
        },
        {
            id: '3',
            name: 'Ryan McCarthy',
            team: 'Catholic Memorial',
            position: 'Forward',
            goals: 25,
            assists: 28,
            points: 53,
            season_id: '1'
        },
        {
            id: '4',
            name: 'Patrick O\'Brien',
            team: 'Malden Catholic',
            position: 'Forward',
            goals: 22,
            assists: 24,
            points: 46,
            season_id: '1'
        },
        {
            id: '5',
            name: 'Chris Walsh',
            team: 'St. Johns Prep',
            position: 'Forward',
            goals: 19,
            assists: 26,
            points: 45,
            season_id: '1'
        },
        {
            id: '6',
            name: 'Tyler Johnson',
            team: 'Wellesley',
            position: 'Forward',
            goals: 35,
            assists: 38,
            points: 73,
            season_id: '1'
        },
        {
            id: '7',
            name: 'Jake Anderson',
            team: 'Wellesley',
            position: 'Defense',
            goals: 12,
            assists: 30,
            points: 42,
            season_id: '1'
        },
        {
            id: '8',
            name: 'Matt Davis',
            team: 'Newton South',
            position: 'Forward',
            goals: 18,
            assists: 21,
            points: 39,
            season_id: '1'
        },
        {
            id: '9',
            name: 'Brian Wilson',
            team: 'Needham',
            position: 'Forward',
            goals: 16,
            assists: 19,
            points: 35,
            season_id: '1'
        },
        {
            id: '10',
            name: 'Kevin Murphy',
            team: 'Billerica',
            position: 'Forward',
            goals: 21,
            assists: 23,
            points: 44,
            season_id: '1'
        },
        {
            id: '11',
            name: 'Tom Brady',
            team: 'BC High',
            position: 'Goalie',
            goals: 0,
            assists: 0,
            points: 0,
            gaa: '2.15',
            save_pct: '.925',
            season_id: '1'
        },
        {
            id: '12',
            name: 'Sean Kelly',
            team: 'Catholic Memorial',
            position: 'Goalie',
            goals: 0,
            assists: 0,
            points: 0,
            gaa: '2.45',
            save_pct: '.915',
            season_id: '1'
        },
        {
            id: '13',
            name: 'Dan Richards',
            team: 'Wellesley',
            position: 'Goalie',
            goals: 0,
            assists: 2,
            points: 2,
            gaa: '1.85',
            save_pct: '.935',
            season_id: '1'
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

        return { teams, games, players, leagues, divisions, seasons, locations };
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

        return data;
    } catch (error) {
        console.error('Failed to load from API:', error);
        throw new Error('Could not connect to database API');
    }
}

// Export configuration so users can modify it easily
if (typeof window !== 'undefined') {
    window.DATA_CONFIG = DATA_CONFIG;
}
