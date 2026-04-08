USE ipl_scorecard;

INSERT INTO teams (team_id, team_name, short_name) VALUES
('RCB', 'Royal Challengers Bengaluru', 'RCB'),
('CSK', 'Chennai Super Kings', 'CSK'),
('MI', 'Mumbai Indians', 'MI'),
('KKR', 'Kolkata Knight Riders', 'KKR'),
('SRH', 'Sunrisers Hyderabad', 'SRH'),
('DC', 'Delhi Capitals', 'DC'),
('RR', 'Rajasthan Royals', 'RR'),
('PBKS', 'Punjab Kings', 'PBKS'),
('GT', 'Gujarat Titans', 'GT'),
('LSG', 'Lucknow Super Giants', 'LSG')
ON DUPLICATE KEY UPDATE
team_name = VALUES(team_name),
short_name = VALUES(short_name);