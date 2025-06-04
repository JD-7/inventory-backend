// migrate.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, 'inventory.db');
const EXCEL_PATH = path.join(__dirname, 'inventory_data.xlsx');

// 1) Read the Excel workbook
const workbook = XLSX.readFile(EXCEL_PATH);

// 2) Open (or create) the SQLite database
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  console.log('Creating tables (if they do not exist)...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema, err => {
    if (err) {
      console.error('Error executing schema.sql:', err);
      process.exit(1);
    }
    console.log('Tables are ready.');

    // 3) Migrate FD NAME MASTER → Products
    console.log('Migrating FD NAME MASTER...');
    const prodSheet = workbook.Sheets['FD NAME MASTER'];
    if (!prodSheet) {
      console.error('Sheet "FD NAME MASTER" not found.');
      process.exit(1);
    }
    const prodRows = XLSX.utils.sheet_to_json(prodSheet, {
      range: 1,
      header: ['FD_NAME'],
      blankrows: false
    });
    const insertProduct = db.prepare('INSERT OR IGNORE INTO Products (FD_NAME) VALUES (?)');
    prodRows.forEach(r => {
      if (r.FD_NAME && r.FD_NAME.toString().trim() !== '') {
        insertProduct.run(r.FD_NAME.trim());
      }
    });
    insertProduct.finalize(err => {
      if (err) console.error('Error inserting products:', err);
      else console.log('Products migration complete.');
    });

    // 4) Migrate Inward Qty → InwardTransactions
    console.log('Migrating Inward Qty...');
    const inwardSheet = workbook.Sheets['Inward Qty'];
    if (!inwardSheet) {
      console.error('Sheet "Inward Qty" not found.');
      process.exit(1);
    }
    const inwardRows = XLSX.utils.sheet_to_json(inwardSheet, {
      range: 2,
      header: [
        'SR_No',
        'DateTime',
        'FD_NAME',
        'Pouch_Date',
        'Num_Pouches',
        'Qty_GM',
        'Remarks'
      ],
      blankrows: false
    });
    const insertInward = db.prepare(`
      INSERT INTO InwardTransactions
      (SR_No, DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    inwardRows.forEach(r => {
      if (!r.FD_NAME) return;
      insertInward.run(
        r.SR_No || null,
        r.DateTime ? r.DateTime.toString() : null,
        r.FD_NAME.toString().trim(),
        r.Pouch_Date ? r.Pouch_Date.toString() : null,
        Number(r.Num_Pouches) || 0,
        Number(r.Qty_GM) || 0,
        r.Remarks ? r.Remarks.toString() : null
      );
    });
    insertInward.finalize(err => {
      if (err) console.error('Error inserting inward rows:', err);
      else console.log('Inward migration complete.');
    });

    // 5) Migrate Despatch Qty → DispatchTransactions
    console.log('Migrating Despatch Qty...');
    const dispatchSheet = workbook.Sheets['Despatch Qty'];
    if (!dispatchSheet) {
      console.error('Sheet "Despatch Qty" not found.');
      process.exit(1);
    }
    const dispatchRows = XLSX.utils.sheet_to_json(dispatchSheet, {
      range: 2,
      header: [
        'SR_No',
        'DateTime',
        'FD_NAME',
        'Pouch_Date',
        'Num_Pouches',
        'Qty_GM',
        'Remarks'
      ],
      blankrows: false
    });
    const insertDispatch = db.prepare(`
      INSERT INTO DispatchTransactions
      (SR_No, DateTime, FD_NAME, Pouch_Date, Num_Pouches, Qty_GM, Remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    dispatchRows.forEach(r => {
      if (!r.FD_NAME) return;
      insertDispatch.run(
        r.SR_No || null,
        r.DateTime ? r.DateTime.toString() : null,
        r.FD_NAME.toString().trim(),
        r.Pouch_Date ? r.Pouch_Date.toString() : null,
        Number(r.Num_Pouches) || 0,
        Number(r.Qty_GM) || 0,
        r.Remarks ? r.Remarks.toString() : null
      );
    });
    insertDispatch.finalize(err => {
      if (err) console.error('Error inserting dispatch rows:', err);
      else console.log('Despatch migration complete.');
    });

    // 6) Close DB
    db.close(err => {
      if (err) console.error('Error closing DB:', err);
      else console.log('Migration finished. Database closed.');
    });
  });
});
