const express = require("express");

const app = express();
app.use(express.json());

const VERKADA_API_KEY = process.env.VERKADA_API_KEY;
const VERKADA_CAMERA_ID = process.env.VERKADA_CAMERA_ID;

let VERKADA_EVENT_TYPE_ID = process.env.VERKADA_EVENT_TYPE_ID || null;

async function getVerkadaToken() {
  const response = await fetch("https://api.verkada.com/token", {
    method: "POST",
    headers: {
      "x-api-key": VERKADA_API_KEY
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Verkada token error:", data);
    throw new Error("Could not get Verkada token");
  }

  return data.token;
}

async function createEventTypeIfNeeded(token) {
  if (VERKADA_EVENT_TYPE_ID) return VERKADA_EVENT_TYPE_ID;

  const response = await fetch("https://api.verkada.com/cameras/v1/video_tagging/event_type", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-verkada-auth": token
    },
    body: JSON.stringify({
      name: "Epos Transaction",
      event_schema: {
        receipt_id: "string",
        amount: "float",
        employee: "string",
        payment_type: "string",
        items: "string"
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("Verkada event type error:", data);
    throw new Error("Could not create Verkada event type");
  }

  VERKADA_EVENT_TYPE_ID = data.event_type_uid;
  console.log("Created Verkada Event Type:", VERKADA_EVENT_TYPE_ID);

  return VERKADA_EVENT_TYPE_ID;
}

app.post("/epos-webhook", async (req, res) => {
  try {
    console.log("EPOS WEBHOOK RECEIVED:");
    console.log(JSON.stringify(req.body, null, 2));

    const sale = req.body;

    const token = await getVerkadaToken();
    const eventTypeId = await createEventTypeIfNeeded(token);

    const itemsText = (sale.TransactionItems || [])
  .map(item => `ProductID ${item.ProductId} x${item.Quantity} - $${Number(item.UnitPrice || 0).toFixed(2)}`)
  .join(", ");

const paymentText = (sale.Tenders || [])
  .map(tender => `${tender.Type || "UNKNOWN"} $${Number(tender.Amount || 0).toFixed(2)}`)
  .join(", ");

const payload = {
  camera_id: VERKADA_CAMERA_ID,
  event_type_uid: eventTypeId,
  time_ms: new Date(sale.DateTime).getTime(),
  attributes: {
    receipt_id: String(sale.Barcode || sale.Id || "unknown").trim(),
    amount: Number(sale.TotalAmount || 0),
    employee: String(sale.StaffId || "unknown"),
    payment_type: paymentText || "unknown",
    items: itemsText || "unknown"
  }
};

    const response = await fetch("https://api.verkada.com/cameras/v1/video_tagging/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-verkada-auth": token
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      console.log("Verkada event error:", text);
      return res.status(500).send("Verkada error");
    }

    console.log("Sent transaction to Verkada:", text);
    res.status(200).send("OK");
  } catch (err) {
    console.error("Bridge error:", err);
    res.status(500).send("Bridge error");
  }
});

app.get("/", (req, res) => {
  res.send("Epos to Verkada bridge is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Bridge server started on port " + PORT);
});
