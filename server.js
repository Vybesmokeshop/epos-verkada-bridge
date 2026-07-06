const express = require("express");

const app = express();

app.use(express.json());

app.post("/epos-webhook", (req, res) => {
  console.log("EPOS WEBHOOK RECEIVED:");
  console.log(JSON.stringify(req.body, null, 2));

  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  res.send("Epos to Verkada bridge is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Bridge server started on port " + PORT);
});