const express = require("express");
const cors = require("cors");
require("dotenv").config();

const teamsRoutes = require("./routes/teams");
const playersRoutes = require("./routes/players");
const matchesRoutes = require("./routes/matches");
const tossRoutes = require("./routes/toss");
const squadRoutes = require("./routes/squad");
const inningsRoutes = require("./routes/innings");
const resultsRoutes = require("./routes/results");
const pointsRoutes = require("./routes/points");
const statsRoutes = require("./routes/stats");


const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "IPL backend running" });
});

app.use("/api/teams", teamsRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/toss", tossRoutes);
app.use("/api/squad", squadRoutes);
app.use("/api/innings", inningsRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/stats", statsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));