const express = require("express");
const router = express.Router();
const matchService = require("../services/matchService");

router.get("/", async (req, res) => {
  try {
    const data = await matchService.getMatches();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:matchId", async (req, res) => {
  try {
    const data = await matchService.getMatchById(req.params.matchId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = await matchService.createMatch(req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;