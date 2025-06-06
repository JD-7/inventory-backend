// server.js

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'inventory.db');

// ────────────────────────────────────────────────────────────────────────────
// 1) Open (or create) the SQLite database
// ────────────────────────────────────────────────────────────────────────────
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// ────────────────────────────────────────────────────────────────────────────
// 2) Middleware
// ────────────────────────────────────────────────────────────────────────────
app.use(cors());            // allow cross‐origin requests from your frontend
app.use(express.json());    // parse JSON bodies (needed for POST requests)

// ────────────────────────────────────────────────────────────────────────────
// 3) GET /products
//    Returns an array of all product names (FD_NAME) from the Products table
//    Example response: ["Amla", "Apple – Green", "Apple – Red", …]
// ────────────────────────────────────────────────────────────────────────────
app.get('/products', (req, res) => {
  const sql = `SELECT FD_NAME FROM Products ORDER BY FD_NAME;`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error querying Products:', err);
      return res.status(500).json({ error: 'DB error fetching products' });
    }
    // rows will be like [{ FD_NAME: "Amla" }, { FD_NAME: "Apple – Green" }, …]
    const productNames = rows.map(r => r.FD_NAME);
    res.json(productNames);
  });
});

//  ─────────────────────────────────────────────────────────────────────────────
//  4) POST /products  → Create a brand-new product name
//  ─────────────────────────────────────────────────────────────────────────────
app.post('/products', (req, res) => {
  const { FD_NAME } = req.body || {};

  // 1) Basic validation: must not be empty/null
  if (!FD_NAME || typeof FD_NAME !== 'string' || !FD_NAME.trim()) {
    return res.status(400).json({ error: 'FD_NAME is required and must be non-empty.' });
  }

  const cleanName = FD_NAME.trim();

  // 2) Insert into Products table
  const sql = `INSERT INTO Products (FD_NAME) VALUES (?)`;
  db.run(sql, [cleanName], function(err) {
    if (err) {
      // If UNIQUE constraint fails → duplicate name
      if (err.message.includes('UNIQUE') || err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: `Product name "${cleanName}" already exists.` });
      }
      console.error('Error inserting new product:', err);
      return res.status(500).json({ error: 'DB error inserting new product.' });
    }
    // 3) On success, return the newly created row ID and name
    res.status(201).json({ id: this.lastID, FD_NAME: cleanName });
  });
});


// ────────────────────────────────────────────────────────────────────────────
// 4) GET /inward
//    Returns all rows from InwardTransactions, ordered by DateTime DESC
//    Example response (array of objects):
//    [
//      {
//        "SR_No": 6,
//        "DateTime": "2025-05-30 11:30:00",
//        "FD_NAME": "Amla",
//        "Pouch_Date": "2025-03-04",
//        "Num_Pouches": 3,
//        "Qty_GM": 300,
//        "Remarks": "nil"
//      },
//      …more rows…
//    ]
// ────────────────────────────────────────────────────────────────────────────
app.get('/inward', (req, res) => {
  const sql = `
    SELECT
      SR_No,
      DateTime,
      FD_NAME,
      Pouch_Date,
      Num_Pouches,
      Qty_GM,
      Remarks
    FROM InwardTransactions
    ORDER BY DateTime DESC, id DESC;
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error querying InwardTransactions:', err);
      return res.status(500).json({ error: 'DB error fetching inward' });
    }
    res.json(rows);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5) GET /dispatch
//    Returns all rows from DispatchTransactions, ordered by DateTime DESC
//    Example response (array of objects):
//    [
//      {
//        "SR_No": 5,
//        "DateTime": "2025-05-28 11:30:00",
//        "FD_NAME": "Bael",
//        "Pouch_Date": "2024-12-31",
//        "Num_Pouches": 5,
//        "Qty_GM": 5000,
//        "Remarks": null
//      },
//      …more rows…
//    ]
// ────────────────────────────────────────────────────────────────────────────
app.get('/dispatch', (req, res) => {
  const sql = `
    SELECT
      SR_No,
      DateTime,
      FD_NAME,
      Pouch_Date,
      Num_Pouches,
      Qty_GM,
      Remarks
    FROM DispatchTransactions
    ORDER BY DateTime DESC, id DESC;
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error querying DispatchTransactions:', err);
      return res.status(500).json({ error: 'DB error fetching dispatch' });
    }
    res.json(rows);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6) GET /balance
//    Returns a live aggregation of inward vs dispatch for each product.
//    Each object has: FD_NAME, Inward_Pouches, Inward_GM, Used_Pouches, Used_GM, Bal_Pouches, Bal_GM
//    Example response:
//    [
//      {
//        "FD_NAME": "Amla",
//        "Inward_Pouches": 17,
//        "Inward_GM": 15200,
//        "Used_Pouches": 5,
//        "Used_GM": 5000,
//        "Bal_Pouches": 12,
//        "Bal_GM": 10200
//      },
//      …more rows…
//    ]
// ────────────────────────────────────────────────────────────────────────────
app.get('/balance', (req, res) => {
  const sql = `
    SELECT
      P.FD_NAME            AS FD_NAME,
      IFNULL(SUM(i.Num_Pouches), 0) AS Inward_Pouches,
      IFNULL(SUM(i.Qty_GM),       0) AS Inward_GM,
      IFNULL(SUM(d.Num_Pouches),  0) AS Used_Pouches,
      IFNULL(SUM(d.Qty_GM),       0) AS Used_GM,
      IFNULL(SUM(i.Num_Pouches),  0) - IFNULL(SUM(d.Num_Pouches), 0) AS Bal_Pouches,
      IFNULL(SUM(i.Qty_GM),       0) - IFNULL(SUM(d.Qty_GM),       0) AS Bal_GM
    FROM Products P
    LEFT JOIN InwardTransactions    i ON i.FD_NAME = P.FD_NAME
    LEFT JOIN DispatchTransactions  d ON d.FD_NAME = P.FD_NAME
    GROUP BY P.FD_NAME
    ORDER BY P.FD_NAME;
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error querying balances:', err);
      return res.status(500).json({ error: 'DB error fetching balance' });
    }
    res.json(rows);
  });
});


// ────────────────────────────────────────────────────────────────────────────
// 7) POST /inward
//    Inserts a new row into InwardTransactions.
//    Expects JSON body:
//    {
//      DateTime: "2025-06-05 14:30:00",
//      FD_NAME: "Amla",
//      Pouch_Date: "2025-06-05",
//      Num_Pouches: 2,
//      Qty_GM: 200,
//      Remarks: "Restocked"
//    }
//    Returns: { success: true, id: <new_row_id> }
// ────────────────────────────────────────────────────────────────────────────
// POST /inward  →  inserts into InwardTransactions
app.post('/inward', (req, res) => {
  const { DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks } = req.body;
  const sql = `
    INSERT INTO InwardTransactions
      (DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks)
    VALUES (?, ?, ?, ?, ?, ?);
  `;
  db.run(sql,
         [ DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks ],
         function(err) {
    if (err) {
      console.error('Error inserting inward:', err);
      return res.status(500).json({ error: 'DB error inserting inward' });
    }
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// POST /dispatch  →  inserts into DispatchTransactions
app.post('/dispatch', (req, res) => {
  const { DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks } = req.body;
  const sql = `
    INSERT INTO DispatchTransactions
      (DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks)
    VALUES (?, ?, ?, ?, ?, ?);
  `;
  db.run(sql,
         [ DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks ],
         function(err) {
    if (err) {
      console.error('Error inserting dispatch:', err);
      return res.status(500).json({ error: 'DB error inserting dispatch' });
    }
    res.status(201).json({ success: true, id: this.lastID });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9) Start the server
// ────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
