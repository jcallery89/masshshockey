-- ============================================================
-- MASSHSHOCKEY UNIFIED DATABASE SCHEMA
-- Final version with correct league mappings
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS staff_teams;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS player_seasons;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS team_seasons;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS divisions;
DROP TABLE IF EXISTS leagues;
DROP TABLE IF EXISTS seasons;

CREATE TABLE seasons (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL
) ENGINE=InnoDB;

CREATE TABLE leagues (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50) NULL,
    gender CHAR(1) NULL,
    INDEX idx_name (name)
) ENGINE=InnoDB;

CREATE TABLE divisions (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE venues (
    id INT PRIMARY KEY,
    name VARCHAR(200) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE teams (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gender CHAR(1) NOT NULL DEFAULT 'M',
    INDEX idx_name (name)
) ENGINE=InnoDB;

CREATE TABLE team_seasons (
    id INT PRIMARY KEY,
    team_id INT NOT NULL,
    season_id INT NOT NULL,
    league_id INT NULL,
    division_id INT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
    points INT DEFAULT 0,
    goals_for INT DEFAULT 0,
    goals_against INT DEFAULT 0,
    win_pct DECIMAL(5,3) DEFAULT 0,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (division_id) REFERENCES divisions(id),
    UNIQUE KEY uk_team_season (team_id, season_id),
    INDEX idx_league (league_id),
    INDEX idx_standings (season_id, league_id, points DESC)
) ENGINE=InnoDB;

CREATE TABLE games (
    id INT PRIMARY KEY,
    season_id INT NOT NULL,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    game_date DATE NULL,
    home_score INT NULL,
    away_score INT NULL,
    venue VARCHAR(200) NULL,
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (home_team_id) REFERENCES teams(id),
    FOREIGN KEY (away_team_id) REFERENCES teams(id),
    INDEX idx_date (game_date),
    INDEX idx_home (home_team_id),
    INDEX idx_away (away_team_id)
) ENGINE=InnoDB;

CREATE TABLE players (
    id INT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    INDEX idx_name (last_name, first_name)
) ENGINE=InnoDB;

CREATE TABLE player_seasons (
    id INT PRIMARY KEY,
    player_id INT NOT NULL,
    team_id INT NOT NULL,
    season_id INT NOT NULL,
    team_season_id INT NULL,
    jersey_number VARCHAR(5) NULL,
    position CHAR(1) NULL,
    position_name VARCHAR(20) NULL,
    year VARCHAR(10) NULL,
    hometown VARCHAR(100) NULL,
    is_captain CHAR(1) DEFAULT 'N',
    games_played DECIMAL(10,4) DEFAULT 0,
    goals INT DEFAULT 0,
    assists INT DEFAULT 0,
    penalty_minutes INT DEFAULT 0,
    goals_against INT DEFAULT 0,
    goals_against_average DECIMAL(5,3) DEFAULT 0,
    shots INT DEFAULT 0,
    saves INT DEFAULT 0,
    save_percentage DECIMAL(5,3) DEFAULT 0,
    shutouts INT DEFAULT 0,
    minutes INT DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (season_id) REFERENCES seasons(id),
    FOREIGN KEY (team_season_id) REFERENCES team_seasons(id),
    INDEX idx_player (player_id),
    INDEX idx_team_season (team_season_id)
) ENGINE=InnoDB;

CREATE TABLE staff (
    id INT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(50) DEFAULT 'Coach'
) ENGINE=InnoDB;

CREATE TABLE staff_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    team_id INT NOT NULL,
    FOREIGN KEY (staff_id) REFERENCES staff(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- VIEWS
CREATE OR REPLACE VIEW v_standings AS
SELECT ts.id, t.name AS team, t.gender, s.name AS season,
       l.name AS league, d.name AS division,
       ts.wins, ts.losses, ts.ties, ts.points,
       ts.goals_for, ts.goals_against, 
       (ts.goals_for - ts.goals_against) AS goal_diff, ts.win_pct
FROM team_seasons ts
JOIN teams t ON ts.team_id = t.id
JOIN seasons s ON ts.season_id = s.id
LEFT JOIN leagues l ON ts.league_id = l.id
LEFT JOIN divisions d ON ts.division_id = d.id;

CREATE OR REPLACE VIEW v_schedule AS
SELECT g.id, g.game_date, s.name AS season,
       ht.name AS home_team, g.home_score,
       at.name AS away_team, g.away_score, g.venue
FROM games g
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at ON g.away_team_id = at.id
JOIN seasons s ON g.season_id = s.id;

CREATE OR REPLACE VIEW v_player_stats AS
SELECT ps.id, p.first_name, p.last_name,
       CONCAT(p.first_name, ' ', p.last_name) AS player_name,
       t.name AS team, s.name AS season,
       ps.jersey_number, ps.position_name, ps.year,
       ps.games_played, ps.goals, ps.assists, 
       (ps.goals + ps.assists) AS points,
       ps.goals_against, ps.goals_against_average, ps.save_percentage
FROM player_seasons ps
JOIN players p ON ps.player_id = p.id
JOIN teams t ON ps.team_id = t.id
JOIN seasons s ON ps.season_id = s.id;
