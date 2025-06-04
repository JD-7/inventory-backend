const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'inventory.db');

// Open SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

app.use(cors());
app.use(express.json());

// 1) GET /products
app.get('/products', (req, res) => {
  const sql = `SELECT FD_NAME FROM Products ORDER BY FD_NAME;`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error querying Products:', err);
      return res.status(500).json({ error: 'DB error fetching products' });
    }
    res.json(rows.map(r => r.FD_NAME));
  });
});

// 2) GET /inward
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

// 3) GET /dispatch
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

// 4) GET /balance
app.get('/balance', (req, res) => {
  const sql = `
    SELECT
      P.FD_NAME AS FD_NAME,
      IFNULL(SUM(i.Num_Pouches), 0) AS Inward_Pouches,
      IFNULL(SUM(i.Qty_GM), 0)       AS Inward_GM,
      IFNULL(SUM(d.Num_Pouches), 0)  AS Used_Pouches,
      IFNULL(SUM(d.Qty_GM), 0)       AS Used_GM,
      IFNULL(SUM(i.Num_Pouches), 0) - IFNULL(SUM(d.Num_Pouches), 0) AS Bal_Pouches,
      IFNULL(SUM(i.Qty_GM), 0)      - IFNULL(SUM(d.Qty_GM), 0)      AS Bal_GM
    FROM Products P
    LEFT JOIN InwardTransactions i ON i.FD_NAME = P.FD_NAME
    LEFT JOIN DispatchTransactions d ON d.FD_NAME = P.FD_NAME
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

app.listen(PORT, () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
