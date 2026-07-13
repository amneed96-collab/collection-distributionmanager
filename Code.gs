const SHEET_MAP = {
  companies: "Companies",
  customers: "Customers",
  products: "Products",
  reps: "Representatives",
  collections: "Collections",
  deliveries: "Deliveries",
  distributions: "Distributions",
};

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  Object.keys(SHEET_MAP).forEach(function (key) {
    const sheet = ss.getSheetByName(SHEET_MAP[key]);
    result[key] = sheet ? readSheet(sheet) : [];
  });
  return jsonResponse(result);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_MAP).forEach(function (key) {
    if (!(key in body)) return;
    const sheetName = SHEET_MAP[key];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    writeSheet(sheet, body[key]);
  });
  return jsonResponse({ status: "ok", savedAt: new Date().toISOString() });
}

function readSheet(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const isEmpty = row.every(function (c) { return c === "" || c === null; });
    if (isEmpty) continue;
    const obj = {};
    headers.forEach(function (h, idx) { obj[h] = parseCell(row[idx]); });
    rows.push(obj);
  }
  return rows;
}

function parseCell(val) {
  if (typeof val === "string" && (val.charAt(0) === "{" || val.charAt(0) === "[")) {
    try { return JSON.parse(val); } catch (err) { return val; }
  }
  return val;
}

function writeSheet(sheet, rows) {
  sheet.clearContents();
  if (!rows || rows.length === 0) return;
  const headerSet = {};
  rows.forEach(function (r) {
    Object.keys(r).forEach(function (k) { headerSet[k] = true; });
  });
  const headers = Object.keys(headerSet);
  const data = [headers];
  rows.forEach(function (r) {
    const line = headers.map(function (h) {
      const v = r[h];
      if (v === undefined || v === null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    });
    data.push(line);
  });
  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
