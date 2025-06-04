// server.js (place at root of inventory-backend/)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const FILE_PATH = path.join(__dirname, 'inventory_data.xlsx');

app.use(cors());
app.use(bodyParser.json());

function loadWorkbook() {
  return XLSX.readFile(FILE_PATH);
}

// 1) GET /products  → "FD NAME MASTER" sheet as [ "Amla", "Apple – Green", ... ]
app.get('/products', (req, res) => {
  try {
    const wb = loadWorkbook();
    const sheet = wb.Sheets['FD NAME MASTER'];
    if (!sheet) throw new Error('Sheet "FD NAME MASTER" not found');

    const productRows = XLSX.utils.sheet_to_json(sheet, {
      range: 1,
      header: ['FD_NAME'],
      blankrows: false
    });
    const products = productRows.map(r => r.FD_NAME).filter(name => !!name);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// 2) GET /inward  → "Inward Qty" sheet
app.get('/inward', (req, res) => {
  try {
    const wb = loadWorkbook();
    const sheet = wb.Sheets['Inward Qty'];
    if (!sheet) throw new Error('Sheet "Inward Qty" not found');

    const options = {
      range: 2, // skip rows 0–1; header is at row index 2
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
    };
    const data = XLSX.utils.sheet_to_json(sheet, options);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load inward data' });
  }
});

// 3) GET /dispatch  → "Despatch Qty" sheet
app.get('/dispatch', (req, res) => {
  try {
    const wb = loadWorkbook();
    const sheet = wb.Sheets['Despatch Qty'];
    if (!sheet) throw new Error('Sheet "Despatch Qty" not found');

    const options = {
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
    };
    const data = XLSX.utils.sheet_to_json(sheet, options);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dispatch data' });
  }
});

// 4) GET /balance  → "Bal Qty" sheet
app.get('/balance', (req, res) => {
  try {
    const wb = loadWorkbook();
    const sheet = wb.Sheets['Bal Qty'];
    if (!sheet) throw new Error('Sheet "Bal Qty" not found');

    const options = {
      range: 2, // skip the two‐row header block
      header: [
        '__dummy',       // col A (blank or index)
        'FD_NAME',       // col B
        'Inward_Pouches',// col C
        'Inward_GM',     // col D
        'Used_Pouches',  // col E
        'Used_GM',       // col F
        'Bal_Pouches',   // col G
        'Bal_GM'         // col H
      ],
      defval: 0,
      blankrows: false
    };
    let data = XLSX.utils.sheet_to_json(sheet, options);
    data = data.filter(r => r.FD_NAME && r.FD_NAME.toString().trim() !== '');
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load balance data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
