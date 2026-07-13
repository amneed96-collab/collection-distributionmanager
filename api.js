const EMPTY_DATA = {
  companies: [], customers: [], products: [], reps: [],
  collections: [], deliveries: [], distributions: [],
};

function isConfigured() {
  return typeof API_URL === "string" && API_URL.trim().length > 0 && !API_URL.includes("PASTE_YOUR_WEB_APP_URL_HERE");
}

async function loadData() {
  const res = await fetch(API_URL, { method: "GET" });
  if (!res.ok) throw new Error("Google Sheet থেকে ডেটা আনতে ব্যর্থ (status " + res.status + ")");
  const json = await res.json();
  return Object.assign({}, EMPTY_DATA, json);
}

async function saveData(data) {
  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Google Sheet-এ সেভ করতে ব্যর্থ (status " + res.status + ")");
  return res.json();
}
