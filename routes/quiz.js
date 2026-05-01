const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get user stats (points, nickname, rank)
router.get("/stats/:visitor_id", async (req, res) => {
  try {
    const { visitor_id } = req.params;
    
    // Ensure user exists
    const [[user]] = await pool.query(
      "SELECT nickname, total_points FROM quiz_users WHERE visitor_id = ?",
      [visitor_id]
    );

    if (!user) {
      // Create user if not exists
      await pool.query(
        "INSERT INTO quiz_users (visitor_id, nickname, total_points) VALUES (?, ?, 0)",
        [visitor_id, null]
      );
      return res.json({ nickname: null, total_points: 0, rank: null });
    }

    // Get rank
    const [[{ rank }]] = await pool.query(
      "SELECT COUNT(*) + 1 as `rank` FROM quiz_users WHERE total_points > ?",
      [user.total_points]
    );

    res.json({ ...user, rank });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get leaderboard (Top 10)
router.get("/leaderboard", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT nickname, total_points FROM quiz_users ORDER BY total_points DESC LIMIT 10"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user history (daily breakdown)
router.get("/history/:visitor_id", async (req, res) => {
  try {
    const { visitor_id } = req.params;
    const [rows] = await pool.query(
      `SELECT DATE(attempted_at) as date, SUM(points_earned) as points 
       FROM quiz_attempts 
       WHERE visitor_id = ? 
       GROUP BY DATE(attempted_at) 
       ORDER BY date DESC`,
      [visitor_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user attempts (to disable buttons in frontend)
router.get("/attempts/:visitor_id", async (req, res) => {
  try {
    const { visitor_id } = req.params;
    const [rows] = await pool.query(
      "SELECT question_id, selected_option, is_correct FROM quiz_attempts WHERE visitor_id = ?",
      [visitor_id]
    );
    
    const attemptsMap = {};
    rows.forEach(row => {
      attemptsMap[row.question_id] = { 
        selectedOption: row.selected_option, 
        isCorrect: !!row.is_correct 
      };
    });
    
    res.json(attemptsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit quiz attempt
router.post("/attempt", async (req, res) => {
  try {
    const { visitor_id, question_id, selected_option, is_correct, points_earned } = req.body;
    console.log("Quiz Attempt Request:", { visitor_id, question_id, selected_option, is_correct, points_earned });

    // 0. Ensure user exists
    await pool.query(
      "INSERT IGNORE INTO quiz_users (visitor_id, nickname, total_points) VALUES (?, ?, 0)",
      [visitor_id, null]
    );

    // 1. Record attempt
    await pool.query(
      "INSERT INTO quiz_attempts (visitor_id, question_id, selected_option, is_correct, points_earned) VALUES (?, ?, ?, ?, ?)",
      [visitor_id, question_id, selected_option, is_correct, points_earned]
    );

    // 2. Update total points
    await pool.query(
      "UPDATE quiz_users SET total_points = total_points + ? WHERE visitor_id = ?",
      [points_earned, visitor_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Quiz Attempt Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update nickname
router.post("/nickname", async (req, res) => {
  try {
    const { visitor_id, nickname } = req.body;
    await pool.query(
      "UPDATE quiz_users SET nickname = ? WHERE visitor_id = ?",
      [nickname, visitor_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
