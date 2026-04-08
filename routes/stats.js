const express = require("express");
const router = express.Router();
const statsService = require("../services/statsService");

router.get("/players", async (req, res) => {
  try {
    const data = await statsService.getPlayerStats();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;