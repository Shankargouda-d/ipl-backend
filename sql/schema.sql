CREATE DATABASE IF NOT EXISTS ipl_scorecard;
USE ipl_scorecard;

CREATE TABLE IF NOT EXISTS teams (
  team_id VARCHAR(10) PRIMARY KEY,
  team_name VARCHAR(100) NOT NULL UNIQUE,
  short_name VARCHAR(10) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS players (
  player_id VARCHAR(20) PRIMARY KEY,
  player_name VARCHAR(100) NOT NULL,
  team_id VARCHAR(10) NOT NULL,
  player_role VARCHAR(50) NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS matches (
  match_id INT AUTO_INCREMENT PRIMARY KEY,
  match_no INT NOT NULL UNIQUE,
  team1_id VARCHAR(10) NOT NULL,
  team2_id VARCHAR(10) NOT NULL,
  match_date DATE NOT NULL,
  match_time TIME NOT NULL,
  venue VARCHAR(150) NOT NULL,
  FOREIGN KEY (team1_id) REFERENCES teams(team_id),
  FOREIGN KEY (team2_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS match_toss (
  match_id INT PRIMARY KEY,
  toss_winner_team_id VARCHAR(10) NOT NULL,
  toss_decision ENUM('bat','bowl') NOT NULL,
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (toss_winner_team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS match_team_selection (
  selection_id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  team_id VARCHAR(10) NOT NULL,
  player_id VARCHAR(20) NOT NULL,
  is_playing_xi TINYINT(1) DEFAULT 1,
  is_impact_player TINYINT(1) DEFAULT 0,
  UNIQUE KEY unique_selection (match_id, team_id, player_id),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS innings (
  innings_id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  innings_no INT NOT NULL,
  batting_team_id VARCHAR(10) NOT NULL,
  bowling_team_id VARCHAR(10) NOT NULL,
  total_runs INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  overs_bowled INT NOT NULL DEFAULT 0,
  balls_bowled INT NOT NULL DEFAULT 0,
  wides INT NOT NULL DEFAULT 0,
  no_balls INT NOT NULL DEFAULT 0,
  byes INT NOT NULL DEFAULT 0,
  leg_byes INT NOT NULL DEFAULT 0,
  penalty_runs INT NOT NULL DEFAULT 0,
  is_all_out TINYINT(1) DEFAULT 0,
  max_overs INT NOT NULL DEFAULT 20,
  UNIQUE KEY unique_innings (match_id, innings_no),
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (batting_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (bowling_team_id) REFERENCES teams(team_id)
);

CREATE TABLE IF NOT EXISTS innings_batting (
  batting_id INT AUTO_INCREMENT PRIMARY KEY,
  innings_id INT NOT NULL,
  player_id VARCHAR(20) NOT NULL,
  batting_position INT NULL,
  runs INT NOT NULL DEFAULT 0,
  balls INT NOT NULL DEFAULT 0,
  fours INT NOT NULL DEFAULT 0,
  sixes INT NOT NULL DEFAULT 0,
  is_out TINYINT(1) DEFAULT 0,
  dismissal_type VARCHAR(50),
  strike_rate DECIMAL(6,2) DEFAULT 0.00,
  FOREIGN KEY (innings_id) REFERENCES innings(innings_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS innings_bowling (
  bowling_id INT AUTO_INCREMENT PRIMARY KEY,
  innings_id INT NOT NULL,
  player_id VARCHAR(20) NOT NULL,
  overs INT NOT NULL DEFAULT 0,
  balls INT NOT NULL DEFAULT 0,
  maidens INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  economy DECIMAL(6,2) DEFAULT 0.00,
  FOREIGN KEY (innings_id) REFERENCES innings(innings_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS match_result (
  result_id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL UNIQUE,
  team1_id VARCHAR(10) NOT NULL,
  team2_id VARCHAR(10) NOT NULL,
  team1_runs INT NOT NULL DEFAULT 0,
  team2_runs INT NOT NULL DEFAULT 0,
  winner_team_id VARCHAR(10) NULL,
  win_type VARCHAR(20) NULL,
  win_margin INT DEFAULT 0,
  player_of_match_id VARCHAR(20) NULL,
  FOREIGN KEY (match_id) REFERENCES matches(match_id),
  FOREIGN KEY (team1_id) REFERENCES teams(team_id),
  FOREIGN KEY (team2_id) REFERENCES teams(team_id),
  FOREIGN KEY (winner_team_id) REFERENCES teams(team_id),
  FOREIGN KEY (player_of_match_id) REFERENCES players(player_id)
);