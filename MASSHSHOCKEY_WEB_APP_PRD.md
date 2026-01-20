# MassHSHockey Web Application Update PRD

## Overview

Update the MassHSHockey web application to use the new unified database schema. The database has been migrated from the legacy WordPress/SportsPress structure to a clean relational schema covering 2008-2023 seasons.

## Current State

### Repository
- **GitHub:** https://github.com/jcallery89/masshshockey/
- **Local files:** P:\Claude\MassHSHockey

### Database Location
- **SQL files:** Download `masshshockey_final.zip` from this conversation
- **Contains:** 11 SQL insert files + schema.sql
- **Hosting:** Siteground (to be deployed)

---

## Database Schema

### Tables

```
seasons (15 records)
├── id INT PRIMARY KEY
├── name VARCHAR(50)         -- "2018-2019 Season"
├── start_date DATE
└── end_date DATE

leagues (249 records)
├── id INT PRIMARY KEY
├── name VARCHAR(100)        -- "Catholic Central", "Womens D1"
├── short_name VARCHAR(50)
└── gender CHAR(1)           -- M, W, or NULL

divisions (6 records)
├── id INT PRIMARY KEY
└── name VARCHAR(50)         -- "Division 1" through "Division 6"

teams (539 records)
├── id INT PRIMARY KEY
├── name VARCHAR(100)        -- "Andover", "Austin Prep" (no more "(W)" suffix)
└── gender CHAR(1)           -- M, F, or W

team_seasons (4,469 records)
├── id INT PRIMARY KEY
├── team_id INT → teams.id
├── season_id INT → seasons.id
├── league_id INT → leagues.id (nullable)
├── division_id INT → divisions.id (nullable)
├── wins, losses, ties, points INT
├── goals_for, goals_against INT
└── win_pct DECIMAL(5,3)

games (44,818 records)
├── id INT PRIMARY KEY
├── season_id INT → seasons.id
├── home_team_id INT → teams.id
├── away_team_id INT → teams.id
├── game_date DATE
├── home_score, away_score INT (nullable)
└── venue VARCHAR(200)

players (56,976 records)
├── id INT PRIMARY KEY
├── first_name VARCHAR(50)
└── last_name VARCHAR(50)

player_seasons (59,880 records)
├── id INT PRIMARY KEY
├── player_id INT → players.id
├── team_id INT → teams.id
├── season_id INT → seasons.id
├── team_season_id INT → team_seasons.id (nullable)
├── jersey_number VARCHAR(5)
├── position CHAR(1)         -- F, D, G, or NULL
├── position_name VARCHAR(20) -- "Forward", "Defense", "Goalie"
├── year VARCHAR(10)         -- "SR", "JR", "Soph", "FR"
├── hometown VARCHAR(100)
├── is_captain CHAR(1)       -- Y, C, A, or N
├── games_played DECIMAL
├── goals, assists INT
├── penalty_minutes INT
├── goals_against INT        -- for goalies
├── goals_against_average DECIMAL
├── saves, shots INT
├── save_percentage DECIMAL
├── shutouts, minutes INT
└── (points = goals + assists, calculated)

staff (1,208 records)
├── id INT PRIMARY KEY
├── first_name, last_name VARCHAR(50)
└── role VARCHAR(50)         -- "Coach"

staff_teams (1,215 records)
├── staff_id INT → staff.id
└── team_id INT → teams.id
```

### Pre-built Views

```sql
v_standings    -- Team standings with league/division names joined
v_schedule     -- Games with team names joined
v_player_stats -- Player stats with team/season names, calculated points
```

---

## Key Schema Differences from Legacy

| Aspect | Old (WordPress/SportsPress) | New (Unified) |
|--------|----------------------------|---------------|
| Team naming | "Andover (W)" for women | "Andover" with gender='W' |
| League naming | "Bay State Carey (W)" | "Bay State Carey" with gender='W' |
| Player-team link | Via WordPress post meta | Direct FK: player_seasons.team_season_id |
| Standings | Serialized PHP in wp_postmeta | Normalized in team_seasons table |
| Seasons | WordPress taxonomy terms | Simple seasons table (id 1-15) |

---

## Required Web Application Updates

### 1. Database Connection
- Update connection to use new database (or new tables in existing DB)
- May need to create database and run schema.sql + insert files

### 2. Team Browsing/Listing
- Query `teams` table, join with `team_seasons` for active seasons
- Filter by gender (M/F/W) instead of name suffix
- Show league from `team_seasons.league_id → leagues.name`

**Sample Query:**
```sql
SELECT DISTINCT t.id, t.name, t.gender, l.name as league
FROM teams t
JOIN team_seasons ts ON t.id = ts.team_id
LEFT JOIN leagues l ON ts.league_id = l.id
WHERE ts.season_id = 15  -- 2022-2023
ORDER BY t.name;
```

### 3. Standings Page
- Use `v_standings` view or join team_seasons with teams/leagues
- Group by league, sort by points DESC

**Sample Query:**
```sql
SELECT team, league, wins, losses, ties, points, 
       goals_for, goals_against, win_pct
FROM v_standings
WHERE season = '2022-2023 Season' 
  AND league IS NOT NULL
ORDER BY league, points DESC, win_pct DESC;
```

### 4. Team Detail Page
- Show team info from `teams`
- Show roster from `player_seasons` joined with `players`
- Show schedule from `games`
- Show coach from `staff_teams` joined with `staff`

**Roster Query:**
```sql
SELECT p.first_name, p.last_name, ps.jersey_number,
       ps.position_name, ps.year, ps.hometown,
       ps.goals, ps.assists, (ps.goals + ps.assists) as points
FROM player_seasons ps
JOIN players p ON ps.player_id = p.id
WHERE ps.team_id = ? AND ps.season_id = ?
ORDER BY CAST(ps.jersey_number AS UNSIGNED), ps.last_name;
```

**Schedule Query:**
```sql
SELECT g.game_date, 
       ht.name as home_team, g.home_score,
       at.name as away_team, g.away_score,
       g.venue
FROM games g
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at ON g.away_team_id = at.id
WHERE (g.home_team_id = ? OR g.away_team_id = ?)
  AND g.season_id = ?
ORDER BY g.game_date;
```

### 5. Player Stats/Leaders
- Query `player_seasons` with aggregations
- Separate skater stats (goals, assists, points) from goalie stats

**Top Scorers:**
```sql
SELECT p.first_name, p.last_name, t.name as team,
       ps.goals, ps.assists, (ps.goals + ps.assists) as points
FROM player_seasons ps
JOIN players p ON ps.player_id = p.id
JOIN teams t ON ps.team_id = t.id
WHERE ps.season_id = ? AND ps.position != 'G'
ORDER BY points DESC, ps.goals DESC
LIMIT 50;
```

**Top Goalies:**
```sql
SELECT p.first_name, p.last_name, t.name as team,
       ps.goals_against_average, ps.save_percentage, ps.shutouts
FROM player_seasons ps
JOIN players p ON ps.player_id = p.id
JOIN teams t ON ps.team_id = t.id
WHERE ps.season_id = ? AND ps.position = 'G'
  AND ps.games_played > 5
ORDER BY ps.goals_against_average ASC
LIMIT 25;
```

### 6. Search Functionality
- Search teams by name
- Search players by name
- Filter by season, league, gender

### 7. Season Selector
- Populate from `seasons` table
- Season IDs: 1-11 (2008-2019), 12-15 (2019-2023)

```sql
SELECT id, name FROM seasons ORDER BY id DESC;
```

---

## Season ID Reference

| ID | Season |
|----|--------|
| 1 | 2008-2009 |
| 2 | 2009-2010 |
| 3 | 2010-2011 |
| 4 | 2011-2012 |
| 5 | 2012-2013 |
| 6 | 2013-2014 |
| 7 | 2014-2015 |
| 8 | 2015-2016 |
| 9 | 2016-2017 |
| 10 | 2017-2018 |
| 11 | 2018-2019 |
| 12 | 2019-2020 |
| 13 | 2020-2021 |
| 14 | 2021-2022 |
| 15 | 2022-2023 |

---

## Database Installation Steps

1. Create database:
```sql
CREATE DATABASE masshshockey CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Run schema:
```bash
mysql -u username -p masshshockey < schema.sql
```

3. Load data in order:
```bash
mysql -u username -p masshshockey < insert_seasons.sql
mysql -u username -p masshshockey < insert_leagues.sql
mysql -u username -p masshshockey < insert_divisions.sql
mysql -u username -p masshshockey < insert_venues.sql
mysql -u username -p masshshockey < insert_teams.sql
mysql -u username -p masshshockey < insert_team_seasons.sql
mysql -u username -p masshshockey < insert_games.sql
mysql -u username -p masshshockey < insert_players.sql
mysql -u username -p masshshockey < insert_player_seasons.sql
mysql -u username -p masshshockey < insert_staff.sql
mysql -u username -p masshshockey < insert_staff_teams.sql
```

---

## Files to Update

Based on typical MassHSHockey web app structure, likely files needing updates:

- `config/database.php` - Connection settings
- `models/Team.php` - Team queries
- `models/Player.php` - Player queries  
- `models/Game.php` - Game/schedule queries
- `controllers/StandingsController.php` - Standings logic
- `controllers/TeamController.php` - Team detail logic
- `views/standings.php` - Standings display
- `views/team.php` - Team detail display
- `views/roster.php` - Roster display
- `api/*.php` - Any API endpoints

---

## Testing Checklist

- [ ] Database connection works
- [ ] Season dropdown populates (15 seasons)
- [ ] Standings page shows teams grouped by league
- [ ] Team detail page shows roster with stats
- [ ] Team schedule displays correctly
- [ ] Player search works
- [ ] Gender filter works (Men's vs Women's)
- [ ] All 15 seasons accessible
- [ ] No "(W)" appears in team/league names

---

## Claude Code Best Practices

### Initial Setup
1. Share this PRD at the start of the session
2. Have Claude Code read the existing codebase structure first before making changes
3. Extract the database zip to your local project folder

### Using Subagents
Subagents are useful for parallelizing independent tasks. Good candidates:

```
# Example: Update multiple model files in parallel
"Use subagents to update Team.php, Player.php, and Game.php models 
to use the new schema. Each subagent should handle one model file."
```

**When to use subagents:**
- Updating multiple independent files (models, controllers, views)
- Running tests while making changes elsewhere
- Generating documentation while refactoring code

**When NOT to use subagents:**
- Tasks with dependencies (update model THEN controller that uses it)
- Small changes to a single file
- When you need to review each step

### Using Brainstorm/Ultrathink
For complex decisions, ask Claude Code to brainstorm first:

```
"Before changing the standings logic, brainstorm 3 different approaches 
for handling the league grouping with the new schema. Consider performance, 
code simplicity, and maintainability."
```

**Good brainstorm prompts for this project:**
- "Brainstorm how to handle the gender filter UI now that (W) is removed from names"
- "Brainstorm the best way to structure the season selector with 15 seasons"
- "Brainstorm caching strategies for the standings queries"

### Recommended Task Sequence

1. **Phase 1: Database Setup**
   ```
   "First, let's set up the database. Review the schema.sql and help me 
   deploy it to Siteground."
   ```

2. **Phase 2: Codebase Analysis**
   ```
   "Read through the existing codebase and identify all files that interact 
   with the database. List them with a brief description of what each does."
   ```

3. **Phase 3: Model Updates (use subagents)**
   ```
   "Use subagents to update the data models to use the new schema. 
   Reference the PRD for the correct table structures and relationships."
   ```

4. **Phase 4: Controller/View Updates**
   ```
   "Update the controllers and views to work with the updated models. 
   Start with standings, then team detail, then player stats."
   ```

5. **Phase 5: Testing**
   ```
   "Test each page: standings, team detail, player stats, search. 
   Verify data displays correctly for multiple seasons."
   ```

### Helpful Prompts

**For debugging:**
```
"The standings page isn't showing league names. Check the query in 
StandingsController and verify the join to the leagues table is correct."
```

**For code review:**
```
"Review the changes we've made to ensure we haven't broken any existing 
functionality. Check for any hardcoded references to the old schema."
```

**For optimization:**
```
"The team detail page is slow. Analyze the queries and suggest optimizations. 
Consider using the pre-built views or adding indexes."
```

---

## Notes

- Women's teams no longer have "(W)" suffix - use `gender` column to filter/display
- Same school can have multiple team records (one per gender: M, F, W)
- `team_season_id` links players to their specific team+season for accurate league assignment
- Some player_seasons (375 of 59,880) don't have team_season_id - edge cases from original data
- Some team_seasons (144 of 4,469) don't have league_id - teams that appeared in games but not standings
