# Massachusetts High School Hockey - Historical Data Viewer

A web application for viewing historical Massachusetts high school hockey data (2008-2019) from the original masshshockey.com website. This is a read-only viewer that preserves team records, game results, player statistics, and league standings.

## Features

### Core Functionality
- **Teams View**: Browse all teams with season records (wins, losses, ties, points, win %)
- **Games Schedule**: View game results with dates, scores, and venues
- **Player Statistics**: Sortable stats including goals, assists, points, GAA, and save percentage
- **League Standings**: Organized standings grouped by division and league

### Interactive Features
- **Team Detail Modal**: Click any team row to view:
  - Full roster with player statistics
  - Complete season schedule with results (W/L/T indicators)
  - Team record summary
- **Player Detail Modal**: Click any player row to view:
  - Position, number, year, hometown
  - Complete statistics (skaters: G/A/Pts; goalies: GAA/SV%/Shutouts)
  - Quick link to view player's team

### Filtering & Search
- **Season Filter**: Select any season from 2008-2019
- **Gender Filter**: Toggle between Boys and Girls teams
- **League Filter**: Filter by league (dynamically populated)
- **Division Filter**: Filter by division (dynamically populated)
- **Team Filter**: Filter by specific team (updates based on other filters)
- **Search**: Quick search across teams, players, and games

### Design
- Responsive design for desktop, tablet, and mobile
- Sortable table columns (click headers to sort)
- Goalie rows highlighted with light blue background
- Win/Loss/Tie color-coded in schedules

## Project Background

This application preserves data from the original masshshockey.com website. The original developer passed away and provided the PHP/SQL files before his passing. This viewer application makes that historical data accessible to the public in a modern, user-friendly format.

## Quick Start

### Running the Application

Start a local web server in the project directory:

```bash
# Using Node.js (recommended)
npx http-server

# Using Python
python -m http.server 8080

# Using PHP
php -S localhost:8080
```

Then visit: `http://localhost:8080`

## Data Coverage

| Category | Count | Notes |
|----------|-------|-------|
| Seasons | 11 | 2008-09 through 2018-19 |
| Team-Season Records | 3,212 | Unique team entries per season |
| Games | 35,018 | All recorded game results |
| Players | 49,083 | Player statistics (seasons 4-11 only) |
| Leagues | 21 | Boys and Girls leagues |
| Divisions | 52 | League subdivisions |

**Note:** Player data only exists for seasons 4-11 (approximately 2011-2019). Earlier seasons have team and game data but no individual player statistics.

## File Structure

```
MassHSHockey/
├── index.html              # Main application interface
├── styles.css              # Application styling (modals, tables, filters)
├── app.js                  # Core application logic (HockeyDataApp class)
├── data-loader.js          # Data loading and configuration
├── extract-data-v2.js      # Node.js script to extract data from SQL dump
├── README.md               # This file
├── data/
│   ├── team_seasons.json   # Teams with seasonal records (3,212 entries)
│   ├── games.json          # All game results (35,018 entries)
│   ├── players.json        # Player statistics (49,083 entries)
│   ├── leagues.json        # League definitions (21 entries)
│   ├── divisions.json      # Division definitions (52 entries)
│   ├── seasons.json        # Season definitions (11 entries)
│   └── locations.json      # Venue/location data
└── [SQL dumps and legacy files]
```

## Data Structure

### Team Seasons (`team_seasons.json`)
```json
{
  "id": "123",
  "team_id": "45",
  "season_id": "9",
  "name": "Abington",
  "league_id": "5",
  "league_name": "South Shore League",
  "division_id": "12",
  "division_name": "Sullivan",
  "gender": "M",
  "wins": 15,
  "losses": 5,
  "ties": 2,
  "points": 32,
  "goals_for": 78,
  "goals_against": 45
}
```

### Games (`games.json`)
```json
{
  "id": "12345",
  "date": "2015-01-15",
  "home_team_id": "123",
  "home_team_name": "Abington",
  "home_score": 4,
  "away_team_id": "456",
  "away_team_name": "Rockland",
  "away_score": 2,
  "venue": "Rockland Arena",
  "season_id": "9",
  "status": "1"
}
```

### Players (`players.json`)
```json
{
  "id": "98765",
  "name": "John Smith",
  "team_id": "123",
  "team_name": "Abington",
  "season_id": "9",
  "position": "Forward",
  "number": "17",
  "year": "Senior",
  "hometown": "Abington, MA",
  "goals": 25,
  "assists": 18,
  "points": 43,
  "games_played": 22,
  "type": "Skater"
}
```

For goalies, additional fields:
```json
{
  "type": "Goalie",
  "goals_against": 45,
  "goals_against_average": 2.05,
  "shots": 520,
  "saves": 475,
  "save_percentage": 0.913,
  "shutouts": 3
}
```

## Database Schema (Original)

The original MySQL database (`masshshockey_production`) uses these key tables:

| Table | Purpose |
|-------|---------|
| `teams` | Base team information |
| `team_season` | Team records per season (the key linking table) |
| `event_mgr` | Game schedules and results |
| `player` | Player statistics per season |
| `leagues` | League definitions |
| `divisions` | Division definitions |
| `division_sections` | Division subdivisions |
| `league_season` | League-season associations |
| `division_season` | Division-season associations |
| `reg_events` | Season/registration events |
| `location` | Venue information |

### Key Relationships
- `team_season.id` links to `event_mgr.home_season_id` / `visit_season_id`
- `team_season.league_season_id` links to `league_season.id`
- `team_season.division_season_id` links to `division_season.id`
- `player.team_id` + `player.reg_events_id` identifies player season

## Extracting Data from SQL Dump

If you need to re-extract data from the SQL dump:

```bash
node extract-data-v2.js
```

This reads `masshshockey_production_1-15-26.sql` and generates all JSON files in the `data/` directory.

## Calculations

### Team Records
- **Points**: `(2 × Wins) + Ties`
- **Win %**: `Points / (2 × Total Games)`

### Player Statistics
- **Points**: `Goals + Assists`
- **GAA (Goals Against Average)**: `Goals Against / Games Played`
- **Save %**: `Saves / Shots`

### Record Types (in original system)
1. **Overall** - All games
2. **League** - Games within same league
3. **Qualifying** - Non-exempt games only
4. **Tournament** - Tournament games only

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Deployment Options

### Static Hosting (Recommended)
Deploy to GitHub Pages, Netlify, or any static host:
1. Upload all files including the `data/` directory
2. Access via your hosting URL

### Local Development
Use any local web server (see Quick Start above).

## Data Mode Configuration

In `data-loader.js`:

```javascript
const DATA_CONFIG = {
    mode: 'JSON',           // 'DEMO', 'JSON', or 'API'
    jsonPath: './data/',
    apiPath: './api.php'
};
```

- **JSON Mode** (default): Loads from `./data/*.json` files
- **DEMO Mode**: Uses built-in sample data
- **API Mode**: Connects to live MySQL database via `api.php`

## Credits

- Original data and website: masshshockey.com
- Data preservation project to maintain historical Massachusetts high school hockey records
- Read-only public archive

## License

This is a data preservation project. The application is provided as-is for viewing historical hockey data. All data belongs to its original sources.
