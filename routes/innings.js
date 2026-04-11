const express = require("express");
const router = express.Router();
const scorecardService = require("../services/scorecardService");

router.post("/save", async (req, res) => {
  try {
    const result = await scorecardService.saveInnings(req.body);
    res.json(result);
  } catch (error) {
    console.error("saveInnings error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:matchId", async (req, res) => {
  try {
    const data = await scorecardService.getInningsByMatch(req.params.matchId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;