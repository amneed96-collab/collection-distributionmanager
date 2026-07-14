/* ---------------------------------- state ---------------------------------- */
let DATA = { companies: [], customers: [], products: [], reps: [], collections: [], deliveries: [], distributions: [] };
let VIEW = "dashboard";
let SYNC_STATE = "idle";
let saveTimer = null;
let IS_LOGGED_IN = false;
let SIDEBAR_OPEN = false;

const CUSTOMER_TYPES = ["Retailer", "Wholesaler", "Distributor"];
const PRODUCT_UNITS = ["pcs", "set", "box", "carton"];
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Mobile Banking", "Cheque"];
const AREAS = ["Feni Sadar", "Sonagazi", "Daganbhuiyan", "Chhagalnaiya","Fullgazi", "Parashuram" ];

const NAV = [
  { key: "dashboard", label: "Dashboard", num: "01" },
  { key: "customers", label: "Customers", num: "02" },
  { key: "products", label: "Products", num: "03" },
  { key: "reps", label: "Representative", num: "04" },
  { key: "collection", label: "Collection", num: "05" },
  { key: "distribution", label: "Distribution", num: "06" },
  { key: "ledger", label: "Ledger", num: "07" },
  { key: "report", label: "Report", num: "08" },
];

/* ---------------------------------- helpers ---------------------------------- */
const genId = (p) => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (n) => "৳" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (!d ? "-" : new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };
const idToName = (list, id) => (list.find((x) => x.id === id) || {}).name || "Unknown";
const nameToId = (list, name) => (list.find((x) => x.name === name) || {}).id || "";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function seedData() {
  const companies = [{ id: "co1", name: "Ananya Publications" }, { id: "co2", name: "Kakoli Prokashoni" }, { id: "co3", name: "Somoy Prokashon" }];
  const customers = [
    { id: "c1", name: "Karim Traders", phone: "01711-000111", address: "22 Mirpur Rd, Dhaka", area: "North Zone", type: "Wholesaler", opening: 5000 },
    { id: "c2", name: "Rahman General Store", phone: "01822-000222", address: "8 Jatrabari, Dhaka", area: "East Zone", type: "Retailer", opening: 0 },
  ];
  const products = [
    { id: "p1", name: "Bangla Shahitto Songroho", companyId: "co1", unit: "pcs", price: 350, stock: 120 },
    { id: "p2", name: "General Knowledge 2026", companyId: "co1", unit: "pcs", price: 280, stock: 85 },
  ];
  const reps = [{ id: "r1", name: "Jahangir Alam", phone: "01711-111000", area: "North Zone" }];
  return { companies, customers, products, reps, collections: [], deliveries: [], distributions: [] };
}

/* ---------------------------------- computed ---------------------------------- */
function customerBalances() {
  const map = {};
  DATA.customers.forEach((c) => (map[c.id] = c.opening || 0));
  DATA.deliveries.forEach((d) => (map[d.customerId] = (map[d.customerId] || 0) + d.total));
  DATA.collections.forEach((c) => (map[c.customerId] = (map[c.customerId] || 0) - c.amount));
  return map;
}
function repPayables() {
  const map = {};
  DATA.reps.forEach((r) => (map[r.id] = 0));
  DATA.collections.forEach((c) => { if (map[c.repId] !== undefined) map[c.repId] += c.amount; });
  DATA.distributions.forEach((d) => { if (map[d.repId] !== undefined) map[d.repId] -= (d.repAmount + d.companyAmount); });
  return map;
}
function undistributedCash() {
  const totalCollected = DATA.collections.reduce((s, c) => s + c.amount, 0);
  const totalDistributed = DATA.distributions.reduce((s, d) => s + d.repAmount + d.companyAmount, 0);
  return totalCollected - totalDistributed;
}

/* ---------------------------------- login ---------------------------------- */
function renderLogin(errorMsg) {
  document.getElementById("root").innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="brand-mark" style="width:44px;height:44px;font-size:16px;">CD</div>
        <h2>Admin Login</h2>
        <p>Collection & Distribution Manager</p>
        <input class="field-input" type="password" id="loginPass" placeholder="Password" onkeydown="if(event.key==='Enter') doLogin()">
        <div class="modal-actions" style="justify-content:center;margin-top:14px;">
          <button class="btn-primary" onclick="doLogin()" style="width:100%;">Login</button>
        </div>
        ${errorMsg ? `<div class="login-error">${esc(errorMsg)}</div>` : ""}
      </div>
    </div>`;
  const inp = document.getElementById("loginPass");
  if (inp) inp.focus();
}
function doLogin() {
  const pass = document.getElementById("loginPass").value;
  if (typeof ADMIN_PASSWORD === "string" && pass === ADMIN_PASSWORD) {
    IS_LOGGED_IN = true;
    sessionStorage.setItem("cdm_logged_in", "1");
    bootApp();
  } else {
    renderLogin("ভুল পাসওয়ার্ড, আবার চেষ্টা করুন।");
  }
}
function doLogout() {
  IS_LOGGED_IN = false;
  sessionStorage.removeItem("cdm_logged_in");
  renderLogin();
}

/* ---------------------------------- render shell ---------------------------------- */
function render() {
  const active = NAV.find((n) => n.key === VIEW);
  const root = document.getElementById("root");
  root.innerHTML = `
    <div class="app-root">
      ${typeof isConfigured === "function" && !isConfigured() ? `<div class="config-banner">⚠️ ডেমো মোড — ডেটা Google Sheet-এ সেভ হচ্ছে না। <code>config.js</code>-এ Web App URL বসান।</div>` : ""}
      <div class="app-body">
        <div class="sidebar-overlay ${SIDEBAR_OPEN ? "show" : ""}" onclick="SIDEBAR_OPEN=false; render();"></div>
        <aside class="sidebar ${SIDEBAR_OPEN ? "open" : ""}">
          <div class="brand"><div class="brand-mark">CD</div><div><div class="brand-title">Collection & Distribution</div><div class="brand-sub">Ledger & Field Operations</div></div></div>
          <nav class="nav-list">
            ${NAV.map((n) => `<button class="nav-item ${n.key === VIEW ? "nav-active" : ""}" onclick="goTo('${n.key}')"><span class="nav-num">${n.num}</span><span>${n.label}</span></button>`).join("")}
            <button class="nav-item" onclick="doLogout()" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;">🔒 <span>Logout</span></button>
          </nav>
        </aside>
        <div class="main-col">
          <header class="topbar">
            <button class="hamburger-btn" onclick="SIDEBAR_OPEN=true; render();"><span></span><span></span><span></span></button>
            <div><div class="topbar-eyebrow">Folio ${active.num}</div><h1 class="topbar-title">${active.label}</h1></div>
            <div class="topbar-right"><span class="sync-pill sync-${SYNC_STATE}">${{ idle: "সংযুক্ত", saving: "সেভ হচ্ছে…", saved: "সেভ হয়েছে", error: "সেভ ব্যর্থ" }[SYNC_STATE]}</span></div>
          </header>
          <main class="content" id="content"></main>
        </div>
      </div>
    </div>`;
  renderView();
}

function goTo(view) { VIEW = view; SIDEBAR_OPEN = false; render(); }

function renderView() {
  const el = document.getElementById("content");
  if (VIEW === "dashboard") el.innerHTML = viewDashboard();
  else if (VIEW === "customers") el.innerHTML = viewCustomers();
  else if (VIEW === "products") el.innerHTML = viewProducts();
  else if (VIEW === "reps") el.innerHTML = viewReps();
  else if (VIEW === "collection") el.innerHTML = viewCollection();
  else if (VIEW === "distribution") el.innerHTML = viewDistribution();
  else if (VIEW === "ledger") el.innerHTML = viewLedger();
  else if (VIEW === "report") el.innerHTML = viewReport();
}

/* ---------------------------------- 01 Dashboard ---------------------------------- */
function viewDashboard() {
  const bal = customerBalances();
  const totalOutstanding = Object.values(bal).reduce((s, v) => s + v, 0);
  const today = todayStr();
  const todayCollection = DATA.collections.filter((c) => c.date === today).reduce((s, c) => s + c.amount, 0);
  const todayDelivery = DATA.deliveries.filter((d) => d.date === today).reduce((s, d) => s + d.total, 0);
  const lowStock = DATA.products.filter((p) => p.stock < 15);
  return `
    <div class="grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">Total Customers</div><div class="stat-value">${DATA.customers.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${DATA.products.length}</div></div>
      <div class="stat-card"><div class="stat-label">Today's Collection</div><div class="stat-value tone-success-text">${fmtMoney(todayCollection)}</div></div>
      <div class="stat-card"><div class="stat-label">Today's Delivery</div><div class="stat-value tone-gold-text">${fmtMoney(todayDelivery)}</div></div>
    </div>
    <div class="panel"><h3 class="panel-title">Cash Position</h3>
      <table class="data-table"><tbody>
        <tr><td>Customer balance due</td><td class="mono-num tone-danger-text">${fmtMoney(totalOutstanding)}</td></tr>
        <tr><td>Undistributed cash</td><td class="mono-num tone-gold-text">${fmtMoney(undistributedCash())}</td></tr>
      </tbody></table>
    </div>
    <div class="panel"><h3 class="panel-title">⚠️ Low Stock</h3>
      <table class="data-table"><thead><tr><th>Product</th><th>Stock</th></tr></thead><tbody>
        ${lowStock.length ? lowStock.map((p) => `<tr><td>${esc(p.name)}</td><td class="mono-num tone-danger-text">${p.stock} ${p.unit}</td></tr>`).join("") : `<tr><td colspan="2"><div class="empty-state">সব পণ্যের স্টক পর্যাপ্ত।</div></td></tr>`}
      </tbody></table>
    </div>`;
}

/* ---------------------------------- 02 Customers ---------------------------------- */
function viewCustomers() {
  const bal = customerBalances();
  return `
    <div class="toolbar">
      <div class="search-box">🔍 <input placeholder="খুঁজুন..." oninput="filterTable('customersTable', this.value)"></div>
      <button class="btn-primary" onclick="openCustomerModal()">+ Add Customer</button>
      ${printButton("Print Customer List")}
    </div>
    <div class="panel">
      ${printHeader("Customer List", "Collection & Distribution Manager")}
      <table class="data-table" id="customersTable">
        <thead><tr><th>Name</th><th>Phone</th><th>Type</th><th>Area</th><th>Balance</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${DATA.customers.length === 0 ? `<tr><td colspan="6"><div class="empty-state">কোনো কাস্টমার নেই।</div></td></tr>` :
            DATA.customers.map((c) => `
              <tr>
                <td><strong>${esc(c.name)}</strong><div style="font-size:11px;color:var(--muted)">${esc(c.address || "")}</div></td>
                <td>${esc(c.phone)}</td>
                <td><span class="badge">${esc(c.type)}</span></td>
                <td>${esc(c.area)}</td>
                <td class="mono-num ${(bal[c.id] || 0) > 0 ? "tone-danger-text" : "tone-success-text"}">${fmtMoney(bal[c.id] || 0)}</td>
                <td class="no-print"><button class="icon-btn" onclick="openCustomerModal('${c.id}')">✏️</button><button class="icon-btn" onclick="deleteCustomer('${c.id}')">🗑️</button></td>
              </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}
function openCustomerModal(id) {
  const c = id ? DATA.customers.find((x) => x.id === id) : null;
  openModal(`${c ? "Edit" : "Add"} Customer`, `
    <div class="modal-body">
      <label class="field-label">Name</label><input class="field-input" id="f_name" value="${esc(c ? c.name : "")}">
      <label class="field-label" style="margin-top:10px;">Phone</label><input class="field-input" id="f_phone" value="${esc(c ? c.phone : "")}">
      <label class="field-label" style="margin-top:10px;">Type</label>
      <select class="field-input" id="f_type">${CUSTOMER_TYPES.map((t) => `<option ${c && c.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Area</label>
      <select class="field-input" id="f_area">${AREAS.map((a) => `<option ${c && c.area === a ? "selected" : ""}>${a}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Address</label><input class="field-input" id="f_address" value="${esc(c ? c.address : "")}">
      <label class="field-label" style="margin-top:10px;">Opening Balance</label><input class="field-input" type="number" id="f_opening" value="${c ? c.opening : 0}">
      <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveCustomer('${id || ""}')">Save</button></div>
    </div>`);
}
function saveCustomer(id) {
  const payload = { name: val("f_name"), phone: val("f_phone"), type: val("f_type"), area: val("f_area"), address: val("f_address"), opening: Number(val("f_opening")) || 0 };
  if (!payload.name || !payload.phone) return alert("Name এবং Phone আবশ্যক।");
  if (id) Object.assign(DATA.customers.find((x) => x.id === id), payload);
  else DATA.customers.push({ id: genId("c"), ...payload });
  closeModal(); persist();
}
function deleteCustomer(id) {
  const c = DATA.customers.find((x) => x.id === id);
  if (!confirm(`"${c.name}" মুছবেন?`)) return;
  DATA.customers = DATA.customers.filter((x) => x.id !== id);
  persist();
}

/* ---------------------------------- 03 Products ---------------------------------- */
function viewProducts() {
  return `
    <div class="toolbar">
      <div class="search-box">🔍 <input placeholder="খুঁজুন..." oninput="filterTable('productsTable', this.value)"></div>
      <div><button class="btn-ghost" onclick="openCompanyModal()">+ Add Company</button> <button class="btn-primary" onclick="openProductModal()" ${!DATA.companies.length ? "disabled" : ""}>+ Add Product</button></div>
    </div>
    <div class="panel">
      <table class="data-table" id="productsTable">
        <thead><tr><th>Product</th><th>Company</th><th>Unit</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          ${DATA.products.length === 0 ? `<tr><td colspan="6"><div class="empty-state">কোনো প্রোডাক্ট নেই।</div></td></tr>` :
            DATA.products.map((p) => `
              <tr>
                <td><strong>${esc(p.name)}</strong></td>
                <td><span class="badge">${esc(idToName(DATA.companies, p.companyId))}</span></td>
                <td>${esc(p.unit)}</td>
                <td class="mono-num">${fmtMoney(p.price)}</td>
                <td class="mono-num ${p.stock < 15 ? "tone-danger-text" : ""}">${p.stock}</td>
                <td><button class="icon-btn" onclick="openProductModal('${p.id}')">✏️</button><button class="icon-btn" onclick="deleteProduct('${p.id}')">🗑️</button></td>
              </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="panel">
      <h3 class="panel-title">Companies</h3>
      <table class="data-table">
        <thead><tr><th>Company</th><th>Products</th><th></th></tr></thead>
        <tbody>
          ${DATA.companies.map((co) => `<tr><td><strong>${esc(co.name)}</strong></td><td>${DATA.products.filter((p) => p.companyId === co.id).length}</td><td><button class="icon-btn" onclick="deleteCompany('${co.id}')">🗑️</button></td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}
function openCompanyModal() {
  openModal("Add Company", `<div class="modal-body"><label class="field-label">Company Name</label><input class="field-input" id="f_coname">
    <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveCompany()">Save</button></div></div>`);
}
function saveCompany() {
  const name = val("f_coname");
  if (!name) return alert("Company name আবশ্যক।");
  DATA.companies.push({ id: genId("co"), name });
  closeModal(); persist();
}
function deleteCompany(id) {
  if (DATA.products.some((p) => p.companyId === id)) return alert("এই কোম্পানির প্রোডাক্ট আছে, আগে সেগুলো সরান।");
  DATA.companies = DATA.companies.filter((x) => x.id !== id);
  persist();
}
function openProductModal(id) {
  const p = id ? DATA.products.find((x) => x.id === id) : null;
  openModal(`${p ? "Edit" : "Add"} Product`, `
    <div class="modal-body">
      <label class="field-label">Name</label><input class="field-input" id="f_pname" value="${esc(p ? p.name : "")}">
      <label class="field-label" style="margin-top:10px;">Company</label><select class="field-input" id="f_pcompany">${DATA.companies.map((c) => `<option value="${c.id}" ${p && p.companyId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Unit</label><select class="field-input" id="f_punit">${PRODUCT_UNITS.map((u) => `<option ${p && p.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Price</label><input class="field-input" type="number" id="f_pprice" value="${p ? p.price : ""}">
      <label class="field-label" style="margin-top:10px;">Stock</label><input class="field-input" type="number" id="f_pstock" value="${p ? p.stock : ""}">
      <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveProduct('${id || ""}')">Save</button></div>
    </div>`);
}
function saveProduct(id) {
  const payload = { name: val("f_pname"), companyId: val("f_pcompany"), unit: val("f_punit"), price: Number(val("f_pprice")) || 0, stock: Number(val("f_pstock")) || 0 };
  if (!payload.name) return alert("Name আবশ্যক।");
  if (id) Object.assign(DATA.products.find((x) => x.id === id), payload);
  else DATA.products.push({ id: genId("p"), ...payload });
  closeModal(); persist();
}
function deleteProduct(id) {
  if (!confirm("প্রোডাক্ট মুছবেন?")) return;
  DATA.products = DATA.products.filter((x) => x.id !== id);
  persist();
}

/* ---------------------------------- 04 Representative ---------------------------------- */
function viewReps() {
  const payables = repPayables();
  return `
    <div class="toolbar">
      <div class="search-box">🔍 <input placeholder="খুঁজুন..." oninput="filterTable('repsTable', this.value)"></div>
      <div><button class="btn-ghost" onclick="openDeliveryModal()" ${!DATA.customers.length || !DATA.reps.length || !DATA.products.length ? "disabled" : ""}>+ Record Delivery</button> <button class="btn-primary" onclick="openRepModal()">+ Add Representative</button> ${printButton("Print Rep List")}</div>
    </div>
    <div class="panel">
      ${printHeader("Representative List", "Collection & Distribution Manager")}
      <table class="data-table" id="repsTable">
        <thead><tr><th>Name</th><th>Phone</th><th>Area</th><th>Collected</th><th>Delivered</th><th>Payable</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${DATA.reps.length === 0 ? `<tr><td colspan="7"><div class="empty-state">কোনো প্রতিনিধি নেই।</div></td></tr>` :
            DATA.reps.map((r) => {
              const collected = DATA.collections.filter((c) => c.repId === r.id).reduce((s, c) => s + c.amount, 0);
              const delivered = DATA.deliveries.filter((d) => d.repId === r.id).reduce((s, d) => s + d.total, 0);
              return `<tr onclick="toggleRepLog('${r.id}')" style="cursor:pointer;">
                <td><strong>${esc(r.name)}</strong></td><td>${esc(r.phone)}</td><td>${esc(r.area)}</td>
                <td class="mono-num tone-success-text">${fmtMoney(collected)}</td>
                <td class="mono-num tone-gold-text">${fmtMoney(delivered)}</td>
                <td class="mono-num tone-danger-text">${fmtMoney(payables[r.id] || 0)}</td>
                <td class="no-print" onclick="event.stopPropagation()"><button class="icon-btn" onclick="openRepModal('${r.id}')">✏️</button><button class="icon-btn" onclick="deleteRep('${r.id}')">🗑️</button></td>
              </tr>
              <tr id="log_${r.id}" style="display:none;"><td colspan="7" style="background:#FAFBFC;">
                ${deliveryLogTable(r.id)}
              </td></tr>`;
            }).join("")}
        </tbody>
      </table>
    </div>`;
}
function toggleRepLog(id) {
  const row = document.getElementById("log_" + id);
  row.style.display = row.style.display === "none" ? "table-row" : "none";
}
function deliveryLogTable(repId) {
  const rows = DATA.deliveries.filter((d) => d.repId === repId).sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<table class="data-table"><thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th></th></tr></thead><tbody>
    ${rows.length === 0 ? `<tr><td colspan="5"><div class="empty-state">কোনো ডেলিভারি নেই।</div></td></tr>` :
      rows.map((d) => `<tr><td>${fmtDate(d.date)}</td><td><strong>${esc(idToName(DATA.customers, d.customerId))}</strong></td>
        <td style="font-size:11px;">${d.items.map((it) => `${esc(idToName(DATA.products, it.productId))} ×${it.qty}`).join(", ")}</td>
        <td class="mono-num tone-gold-text">${fmtMoney(d.total)}</td>
        <td><button class="icon-btn" onclick="event.stopPropagation();openDeliveryModal('${d.id}')">✏️</button><button class="icon-btn" onclick="event.stopPropagation();deleteDelivery('${d.id}')">🗑️</button></td></tr>`).join("")}
  </tbody></table>`;
}
function openRepModal(id) {
  const r = id ? DATA.reps.find((x) => x.id === id) : null;
  openModal(`${r ? "Edit" : "Add"} Representative`, `
    <div class="modal-body">
      <label class="field-label">Name</label><input class="field-input" id="f_rname" value="${esc(r ? r.name : "")}">
      <label class="field-label" style="margin-top:10px;">Phone</label><input class="field-input" id="f_rphone" value="${esc(r ? r.phone : "")}">
      <label class="field-label" style="margin-top:10px;">Area</label><select class="field-input" id="f_rarea">${AREAS.map((a) => `<option ${r && r.area === a ? "selected" : ""}>${a}</option>`).join("")}</select>
      <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveRep('${id || ""}')">Save</button></div>
    </div>`);
}
function saveRep(id) {
  const payload = { name: val("f_rname"), phone: val("f_rphone"), area: val("f_rarea") };
  if (!payload.name) return alert("Name আবশ্যক।");
  if (id) Object.assign(DATA.reps.find((x) => x.id === id), payload);
  else DATA.reps.push({ id: genId("r"), ...payload });
  closeModal(); persist();
}
function deleteRep(id) {
  if (!confirm("প্রতিনিধি মুছবেন?")) return;
  DATA.reps = DATA.reps.filter((x) => x.id !== id);
  persist();
}
function openDeliveryModal(id) {
  const d = id ? DATA.deliveries.find((x) => x.id === id) : null;
  const items = d ? d.items : [{ productId: "", qty: 1, price: 0 }];
  window._deliveryItems = JSON.parse(JSON.stringify(items));
  openModal(`${d ? "Edit" : "Record"} Delivery`, `
    <div class="modal-body">
      <label class="field-label">Date</label><input class="field-input" type="date" id="f_ddate" value="${d ? d.date : todayStr()}">
      <label class="field-label" style="margin-top:10px;">Customer</label><select class="field-input" id="f_dcustomer">${DATA.customers.map((c) => `<option value="${c.id}" ${d && d.customerId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Representative</label><select class="field-input" id="f_drep">${DATA.reps.map((r) => `<option value="${r.id}" ${d && d.repId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:14px;">Product Lines</label>
      <div id="itemBuilder">${renderItemRows()}</div>
      <button type="button" class="btn-ghost" style="margin-top:6px;font-size:12px;" onclick="addItemRow()">+ Add line</button>
      <div style="display:flex;justify-content:space-between;margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);font-weight:700;">
        <span>Total</span><span class="mono-num tone-gold-text" id="deliveryTotal">${fmtMoney(itemsTotal())}</span>
      </div>
      <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveDelivery('${id || ""}')">Save</button></div>
    </div>`);
}
function itemsTotal() { return window._deliveryItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0); }
function renderItemRows() {
  return window._deliveryItems.map((it, idx) => `
    <div style="display:grid;grid-template-columns:2fr 0.7fr 0.9fr auto;gap:6px;margin-bottom:6px;">
      <select class="field-input" onchange="updateItemRow(${idx}, 'productId', this.value)">
        <option value="">Select product</option>
        ${DATA.products.map((p) => `<option value="${p.id}" ${it.productId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
      </select>
      <input class="field-input" type="number" placeholder="Qty" value="${it.qty}" oninput="updateItemRow(${idx}, 'qty', this.value)">
      <input class="field-input" type="number" placeholder="Price" value="${it.price}" oninput="updateItemRow(${idx}, 'price', this.value)">
      <button class="icon-btn" onclick="removeItemRow(${idx})">🗑️</button>
    </div>`).join("");
}
function updateItemRow(idx, key, value) {
  window._deliveryItems[idx][key] = value;
  if (key === "productId") { const p = DATA.products.find((x) => x.id === value); if (p) window._deliveryItems[idx].price = p.price; }
  document.getElementById("itemBuilder").innerHTML = renderItemRows();
  document.getElementById("deliveryTotal").textContent = fmtMoney(itemsTotal());
}
function addItemRow() { window._deliveryItems.push({ productId: "", qty: 1, price: 0 }); document.getElementById("itemBuilder").innerHTML = renderItemRows(); }
function removeItemRow(idx) { window._deliveryItems.splice(idx, 1); document.getElementById("itemBuilder").innerHTML = renderItemRows(); document.getElementById("deliveryTotal").textContent = fmtMoney(itemsTotal()); }
function adjustStock(items, sign) {
  items.forEach((it) => { const p = DATA.products.find((x) => x.id === it.productId); if (p) p.stock = Math.max(0, p.stock + sign * Number(it.qty)); });
}
function saveDelivery(id) {
  const cleanItems = window._deliveryItems.filter((it) => it.productId && Number(it.qty) > 0).map((it) => ({ productId: it.productId, qty: Number(it.qty), price: Number(it.price) || 0 }));
  if (!cleanItems.length) return alert("অন্তত একটা প্রোডাক্ট লাইন যোগ করুন।");
  const total = cleanItems.reduce((s, it) => s + it.qty * it.price, 0);
  const payload = { date: val("f_ddate"), customerId: val("f_dcustomer"), repId: val("f_drep"), items: cleanItems, total };
  if (id) {
    const old = DATA.deliveries.find((x) => x.id === id);
    adjustStock(old.items, +1);
    adjustStock(cleanItems, -1);
    Object.assign(old, payload);
  } else {
    adjustStock(cleanItems, -1);
    DATA.deliveries.push({ id: genId("del"), ...payload });
  }
  closeModal(); persist();
}
function deleteDelivery(id) {
  if (!confirm("ডেলিভারি মুছবেন? স্টক ফেরত যাবে।")) return;
  const d = DATA.deliveries.find((x) => x.id === id);
  adjustStock(d.items, +1);
  DATA.deliveries = DATA.deliveries.filter((x) => x.id !== id);
  persist();
}

/* ---------------------------------- 05 Collection ---------------------------------- */
let COLLECTION_VIEW_MODE = "grouped";
function viewCollection() {
  const rows = [...DATA.collections].sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const groups = groupByDate(rows);
  return `
    <div class="toolbar"><div style="font-size:12.5px;color:var(--muted);">Admin কাস্টমার থেকে টাকা কালেকশন করবে। একই দিনের একাধিক এন্ট্রি একসাথে গ্রুপ হয়ে দেখাবে।</div>
      <div>
        <button class="btn-ghost" onclick="COLLECTION_VIEW_MODE = COLLECTION_VIEW_MODE==='grouped'?'flat':'grouped'; renderView();">${COLLECTION_VIEW_MODE === "grouped" ? "🔀 Flat View" : "📅 Grouped View"}</button>
        <button class="btn-primary" onclick="openCollectionModal()" ${!DATA.customers.length || !DATA.reps.length ? "disabled" : ""}>+ Record Collection</button>
        ${printButton("Print All Receipts")}
      </div>
    </div>
    <div class="panel">
      ${printHeader("Collection Receipt", "Collection & Distribution Manager")}
      ${rows.length === 0 ? `<div class="empty-state">কোনো কালেকশন নেই।</div>` :
        COLLECTION_VIEW_MODE === "grouped" ? groups.map((g) => collectionGroupBlock(g)).join("") : collectionFlatTable(rows)}
      ${rows.length ? `<div style="text-align:right;font-weight:700;margin-top:10px;">সর্বমোট: <span class="mono-num tone-success-text">${fmtMoney(total)}</span></div>` : ""}
    </div>`;
}
function collectionFlatTable(rows) {
  return `<table class="data-table" id="collectionTable">
    <thead><tr><th>Date</th><th>Customer</th><th>Rep</th><th>Method</th><th>Amount</th><th class="no-print"></th></tr></thead>
    <tbody>${rows.map((c) => `<tr><td>${fmtDate(c.date)}</td><td><strong>${esc(idToName(DATA.customers, c.customerId))}</strong></td><td>${esc(idToName(DATA.reps, c.repId))}</td>
      <td><span class="badge">${esc(c.method)}</span></td><td class="mono-num tone-success-text">${fmtMoney(c.amount)}</td>
      <td class="no-print"><button class="icon-btn" onclick="openCollectionModal('${c.id}')">✏️</button><button class="icon-btn" onclick="deleteCollection('${c.id}')">🗑️</button></td></tr>`).join("")}</tbody>
  </table>`;
}
function collectionGroupBlock(g) {
  const dayTotal = g.rows.reduce((s, r) => s + r.amount, 0);
  return `<div class="group-block">
    <div class="group-head"><span>${fmtDate(g.date)} — ${g.rows.length} এন্ট্রি</span><span class="g-total">${fmtMoney(dayTotal)}</span></div>
    <table class="data-table"><thead><tr><th>Customer</th><th>Rep</th><th>Method</th><th>Amount</th><th class="no-print"></th></tr></thead>
      <tbody>${g.rows.map((c) => `<tr><td><strong>${esc(idToName(DATA.customers, c.customerId))}</strong></td><td>${esc(idToName(DATA.reps, c.repId))}</td>
        <td><span class="badge">${esc(c.method)}</span></td><td class="mono-num tone-success-text">${fmtMoney(c.amount)}</td>
        <td class="no-print"><button class="icon-btn" onclick="openCollectionModal('${c.id}')">✏️</button><button class="icon-btn" onclick="deleteCollection('${c.id}')">🗑️</button></td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}
function openCollectionModal(id) {
  const c = id ? DATA.collections.find((x) => x.id === id) : null;
  openModal(`${c ? "Edit" : "Record"} Collection`, `
    <div class="modal-body">
      <label class="field-label">Date</label><input class="field-input" type="date" id="f_cdate" value="${c ? c.date : todayStr()}">
      <label class="field-label" style="margin-top:10px;">Customer</label><select class="field-input" id="f_ccustomer">${DATA.customers.map((x) => `<option value="${x.id}" ${c && c.customerId === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Credit to Rep</label><select class="field-input" id="f_crep">${DATA.reps.map((x) => `<option value="${x.id}" ${c && c.repId === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Amount</label><input class="field-input" type="number" id="f_camount" value="${c ? c.amount : ""}">
      <label class="field-label" style="margin-top:10px;">Method</label><select class="field-input" id="f_cmethod">${PAYMENT_METHODS.map((m) => `<option ${c && c.method === m ? "selected" : ""}>${m}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Note</label><input class="field-input" id="f_cnote" value="${esc(c ? c.note : "")}">
      <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveCollection('${id || ""}')">Save</button></div>
    </div>`);
}
function saveCollection(id) {
  const payload = { date: val("f_cdate"), customerId: val("f_ccustomer"), repId: val("f_crep"), amount: Number(val("f_camount")) || 0, method: val("f_cmethod"), note: val("f_cnote") };
  if (!payload.amount) return alert("Amount আবশ্যক।");
  if (id) Object.assign(DATA.collections.find((x) => x.id === id), payload);
  else DATA.collections.push({ id: genId("col"), ...payload });
  closeModal(); persist();
}
function deleteCollection(id) {
  if (!confirm("এন্ট্রি মুছবেন?")) return;
  DATA.collections = DATA.collections.filter((x) => x.id !== id);
  persist();
}

/* ---------------------------------- 06 Distribution ---------------------------------- */
let DISTRIBUTION_VIEW_MODE = "grouped";
function viewDistribution() {
  const rows = [...DATA.distributions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups = groupByDate(rows);
  return `
    <div class="toolbar"><div style="font-size:12.5px;color:var(--muted);">Admin কালেকশন করা টাকা প্রতিনিধি ও কোম্পানীকে ভাগ করে দেবে। একই দিনের একাধিক এন্ট্রি একসাথে দেখাবে।</div>
      <div>
        <button class="btn-ghost" onclick="DISTRIBUTION_VIEW_MODE = DISTRIBUTION_VIEW_MODE==='grouped'?'flat':'grouped'; renderView();">${DISTRIBUTION_VIEW_MODE === "grouped" ? "🔀 Flat View" : "📅 Grouped View"}</button>
        <button class="btn-primary" onclick="openDistributionModal()" ${!DATA.reps.length || !DATA.companies.length ? "disabled" : ""}>+ Record Distribution</button>
        ${printButton("Print All Receipts")}
      </div>
    </div>
    <div class="grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">Undistributed Cash</div><div class="stat-value tone-gold-text">${fmtMoney(undistributedCash())}</div></div>
      <div class="stat-card"><div class="stat-label">Total to Reps</div><div class="stat-value tone-success-text">${fmtMoney(rows.reduce((s, r) => s + r.repAmount, 0))}</div></div>
      <div class="stat-card"><div class="stat-label">Total to Companies</div><div class="stat-value">${fmtMoney(rows.reduce((s, r) => s + r.companyAmount, 0))}</div></div>
    </div>
    <div class="panel">
      ${printHeader("Distribution Receipt", "Collection & Distribution Manager")}
      ${rows.length === 0 ? `<div class="empty-state">কোনো ডিস্ট্রিবিউশন নেই।</div>` :
        DISTRIBUTION_VIEW_MODE === "grouped" ? groups.map((g) => distributionGroupBlock(g)).join("") : distributionFlatTable(rows)}
    </div>`;
}
function distributionFlatTable(rows) {
  return `<table class="data-table" id="distributionTable">
    <thead><tr><th>Date</th><th>Rep</th><th>Company</th><th>To Rep</th><th>To Company</th><th>Total</th><th class="no-print"></th></tr></thead>
    <tbody>${rows.map((x) => `<tr><td>${fmtDate(x.date)}</td><td><strong>${esc(idToName(DATA.reps, x.repId))}</strong></td><td>${esc(idToName(DATA.companies, x.companyId))}</td>
      <td class="mono-num tone-success-text">${fmtMoney(x.repAmount)}</td><td class="mono-num">${fmtMoney(x.companyAmount)}</td><td class="mono-num tone-gold-text">${fmtMoney(x.repAmount + x.companyAmount)}</td>
      <td class="no-print"><button class="icon-btn" onclick="openDistributionModal('${x.id}')">✏️</button><button class="icon-btn" onclick="deleteDistribution('${x.id}')">🗑️</button></td></tr>`).join("")}</tbody>
  </table>`;
}
function distributionGroupBlock(g) {
  const dayTotal = g.rows.reduce((s, r) => s + r.repAmount + r.companyAmount, 0);
  return `<div class="group-block">
    <div class="group-head"><span>${fmtDate(g.date)} — ${g.rows.length} এন্ট্রি</span><span class="g-total">${fmtMoney(dayTotal)}</span></div>
    <table class="data-table"><thead><tr><th>Rep</th><th>Company</th><th>To Rep</th><th>To Company</th><th class="no-print"></th></tr></thead>
      <tbody>${g.rows.map((x) => `<tr><td><strong>${esc(idToName(DATA.reps, x.repId))}</strong></td><td>${esc(idToName(DATA.companies, x.companyId))}</td>
        <td class="mono-num tone-success-text">${fmtMoney(x.repAmount)}</td><td class="mono-num">${fmtMoney(x.companyAmount)}</td>
        <td class="no-print"><button class="icon-btn" onclick="openDistributionModal('${x.id}')">✏️</button><button class="icon-btn" onclick="deleteDistribution('${x.id}')">🗑️</button></td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}
function openDistributionModal(id) {
  const x = id ? DATA.distributions.find((v) => v.id === id) : null;
  openModal(`${x ? "Edit" : "Record"} Distribution`, `
    <div class="modal-body">
      <label class="field-label">Date</label><input class="field-input" type="date" id="f_xdate" value="${x ? x.date : todayStr()}">
      <label class="field-label" style="margin-top:10px;">Representative</label><select class="field-input" id="f_xrep">${DATA.reps.map((r) => `<option value="${r.id}" ${x && x.repId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Company</label><select class="field-input" id="f_xcompany">${DATA.companies.map((c) => `<option value="${c.id}" ${x && x.companyId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <label class="field-label" style="margin-top:10px;">Amount to Representative</label><input class="field-input" type="number" id="f_xrepamt" value="${x ? x.repAmount : ""}">
      <label class="field-label" style="margin-top:10px;">Amount to Company</label><input class="field-input" type="number" id="f_xcoamt" value="${x ? x.companyAmount : ""}">
      <label class="field-label" style="margin-top:10px;">Note</label><input class="field-input" id="f_xnote" value="${esc(x ? x.note : "")}">
      <div class="modal-actions"><button class="btn-ghost" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="saveDistribution('${id || ""}')">Save</button></div>
    </div>`);
}
function saveDistribution(id) {
  const payload = { date: val("f_xdate"), repId: val("f_xrep"), companyId: val("f_xcompany"), repAmount: Number(val("f_xrepamt")) || 0, companyAmount: Number(val("f_xcoamt")) || 0, note: val("f_xnote") };
  if (id) Object.assign(DATA.distributions.find((v) => v.id === id), payload);
  else DATA.distributions.push({ id: genId("dst"), ...payload });
  closeModal(); persist();
}
function deleteDistribution(id) {
  if (!confirm("এন্ট্রি মুছবেন?")) return;
  DATA.distributions = DATA.distributions.filter((x) => x.id !== id);
  persist();
}

/* ---------------------------------- 07 Ledger ---------------------------------- */
let LEDGER_TAB = "customer", LEDGER_CUSTOMER = null, LEDGER_REP = null;
function viewLedger() {
  if (!LEDGER_CUSTOMER && DATA.customers[0]) LEDGER_CUSTOMER = DATA.customers[0].id;
  if (!LEDGER_REP && DATA.reps[0]) LEDGER_REP = DATA.reps[0].id;
  return `
    <div class="tabs">
      <button class="tab-btn ${LEDGER_TAB === "customer" ? "tab-active" : ""}" onclick="LEDGER_TAB='customer';renderView();">Customer Ledger</button>
      <button class="tab-btn ${LEDGER_TAB === "rep" ? "tab-active" : ""}" onclick="LEDGER_TAB='rep';renderView();">Representative Ledger</button>
    </div>
    ${LEDGER_TAB === "customer" ? customerLedgerHTML() : repLedgerHTML()}`;
}
function customerLedgerHTML() {
  if (!DATA.customers.length) return `<div class="panel"><div class="empty-state">কোনো কাস্টমার নেই।</div></div>`;
  const customer = DATA.customers.find((c) => c.id === LEDGER_CUSTOMER) || DATA.customers[0];
  const rows = [];
  DATA.deliveries.filter((d) => d.customerId === customer.id).forEach((d) => rows.push({ date: d.date, type: "Delivery", debit: d.total, credit: 0 }));
  DATA.collections.filter((c) => c.customerId === customer.id).forEach((c) => rows.push({ date: c.date, type: "Collection (" + c.method + ")", debit: 0, credit: c.amount }));
  rows.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  let bal = customer.opening || 0;
  const withBal = [{ date: "", type: "Opening balance", debit: 0, credit: 0, balance: bal, opening: true }];
  rows.forEach((r) => { bal = bal + r.debit - r.credit; withBal.push({ ...r, balance: bal }); });
  return `
    <select class="field-input no-print" style="max-width:280px;margin-bottom:14px;" onchange="LEDGER_CUSTOMER=this.value;renderView();">
      ${DATA.customers.map((c) => `<option value="${c.id}" ${c.id === customer.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
    </select>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 class="panel-title">Ledger — ${esc(customer.name)}</h3>
        ${printButton("Print Ledger")}
      </div>
      ${printHeader("Customer Ledger — " + customer.name, customer.area + " · " + customer.phone)}
      <table class="data-table"><thead><tr><th>Date</th><th>Particulars</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
        <tbody>${withBal.map((e) => `<tr><td>${e.opening ? "—" : fmtDate(e.date)}</td><td><strong>${esc(e.type)}</strong></td>
          <td class="mono-num">${e.debit ? fmtMoney(e.debit) : "-"}</td><td class="mono-num">${e.credit ? fmtMoney(e.credit) : "-"}</td>
          <td class="mono-num ${e.balance > 0 ? "tone-danger-text" : "tone-success-text"}">${fmtMoney(e.balance)}</td></tr>`).join("")}</tbody>
      </table>
    </div>`;
}
function repLedgerHTML() {
  if (!DATA.reps.length) return `<div class="panel"><div class="empty-state">কোনো প্রতিনিধি নেই।</div></div>`;
  const rep = DATA.reps.find((r) => r.id === LEDGER_REP) || DATA.reps[0];
  const rows = [];
  DATA.collections.filter((c) => c.repId === rep.id).forEach((c) => rows.push({ date: c.date, type: "Collected from " + idToName(DATA.customers, c.customerId), debit: 0, credit: c.amount }));
  DATA.distributions.filter((x) => x.repId === rep.id).forEach((x) => rows.push({ date: x.date, type: `Settled — ${fmtMoney(x.repAmount)} rep, ${fmtMoney(x.companyAmount)} to ${idToName(DATA.companies, x.companyId)}`, debit: x.repAmount + x.companyAmount, credit: 0 }));
  rows.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  let bal = 0;
  const withBal = [{ date: "", type: "Opening balance", debit: 0, credit: 0, balance: 0, opening: true }];
  rows.forEach((r) => { bal = bal + r.credit - r.debit; withBal.push({ ...r, balance: bal }); });
  return `
    <select class="field-input no-print" style="max-width:280px;margin-bottom:14px;" onchange="LEDGER_REP=this.value;renderView();">
      ${DATA.reps.map((r) => `<option value="${r.id}" ${r.id === rep.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
    </select>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 class="panel-title">Ledger — ${esc(rep.name)}</h3>
        ${printButton("Print Ledger")}
      </div>
      ${printHeader("Representative Ledger — " + rep.name, rep.area + " · " + rep.phone)}
      <table class="data-table"><thead><tr><th>Date</th><th>Particulars</th><th>Credit</th><th>Debit</th><th>Cash in Hand</th></tr></thead>
        <tbody>${withBal.map((e) => `<tr><td>${e.opening ? "—" : fmtDate(e.date)}</td><td><strong>${esc(e.type)}</strong></td>
          <td class="mono-num">${e.credit ? fmtMoney(e.credit) : "-"}</td><td class="mono-num">${e.debit ? fmtMoney(e.debit) : "-"}</td>
          <td class="mono-num ${e.balance > 0 ? "tone-danger-text" : "tone-success-text"}">${fmtMoney(e.balance)}</td></tr>`).join("")}</tbody>
      </table>
    </div>`;
}

/* ---------------------------------- 08 Report ---------------------------------- */
let REPORT_TAB = "daily", REPORT_DAY = todayStr(), REPORT_MONTH = todayStr().slice(0, 7), REPORT_YEAR = todayStr().slice(0, 4);
function viewReport() {
  return `
    <div class="toolbar">
      <div class="tabs" style="margin-bottom:0;border-bottom:none;">
        <button class="tab-btn ${REPORT_TAB === "daily" ? "tab-active" : ""}" onclick="REPORT_TAB='daily';renderView();">Daily</button>
        <button class="tab-btn ${REPORT_TAB === "monthly" ? "tab-active" : ""}" onclick="REPORT_TAB='monthly';renderView();">Monthly</button>
        <button class="tab-btn ${REPORT_TAB === "yearly" ? "tab-active" : ""}" onclick="REPORT_TAB='yearly';renderView();">Yearly</button>
      </div>
      ${printButton("Print Report")}
    </div>
    <div id="reportBody">
      ${REPORT_TAB === "daily" ? reportDaily() : REPORT_TAB === "monthly" ? reportMonthly() : reportYearly()}
    </div>`;
}
function reportDaily() {
  const cols = DATA.collections.filter((c) => c.date === REPORT_DAY);
  const dels = DATA.deliveries.filter((d) => d.date === REPORT_DAY);
  const dists = DATA.distributions.filter((x) => x.date === REPORT_DAY);
  return `
    ${printHeader("Daily Report — " + fmtDate(REPORT_DAY), "Collection & Distribution Manager")}
    <input class="field-input no-print" type="date" style="max-width:200px;margin-bottom:14px;" value="${REPORT_DAY}" onchange="REPORT_DAY=this.value;renderView();">
    <div class="grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">Collections</div><div class="stat-value tone-success-text">${fmtMoney(cols.reduce((s, c) => s + c.amount, 0))}</div></div>
      <div class="stat-card"><div class="stat-label">Deliveries</div><div class="stat-value tone-gold-text">${fmtMoney(dels.reduce((s, d) => s + d.total, 0))}</div></div>
      <div class="stat-card"><div class="stat-label">Distributed</div><div class="stat-value">${fmtMoney(dists.reduce((s, x) => s + x.repAmount + x.companyAmount, 0))}</div></div>
    </div>
    <div class="panel"><h3 class="panel-title">Collections — ${fmtDate(REPORT_DAY)}</h3>
      <table class="data-table"><thead><tr><th>Customer</th><th>Amount</th></tr></thead><tbody>
        ${cols.length ? cols.map((c) => `<tr><td><strong>${esc(idToName(DATA.customers, c.customerId))}</strong></td><td class="mono-num tone-success-text">${fmtMoney(c.amount)}</td></tr>`).join("") : `<tr><td colspan="2"><div class="empty-state">এই তারিখে কিছু নেই।</div></td></tr>`}
      </tbody></table>
    </div>
    <div class="panel"><h3 class="panel-title">Deliveries — ${fmtDate(REPORT_DAY)}</h3>
      <table class="data-table"><thead><tr><th>Customer</th><th>Total</th></tr></thead><tbody>
        ${dels.length ? dels.map((d) => `<tr><td><strong>${esc(idToName(DATA.customers, d.customerId))}</strong></td><td class="mono-num tone-gold-text">${fmtMoney(d.total)}</td></tr>`).join("") : `<tr><td colspan="2"><div class="empty-state">এই তারিখে কিছু নেই।</div></td></tr>`}
      </tbody></table>
    </div>
    <div class="panel"><h3 class="panel-title">Distributions — ${fmtDate(REPORT_DAY)}</h3>
      <table class="data-table"><thead><tr><th>Rep / Company</th><th>Total</th></tr></thead><tbody>
        ${dists.length ? dists.map((x) => `<tr><td><strong>${esc(idToName(DATA.reps, x.repId))} / ${esc(idToName(DATA.companies, x.companyId))}</strong></td><td class="mono-num">${fmtMoney(x.repAmount + x.companyAmount)}</td></tr>`).join("") : `<tr><td colspan="2"><div class="empty-state">এই তারিখে কিছু নেই।</div></td></tr>`}
      </tbody></table>
    </div>`;
}
function reportMonthly() {
  const [y, m] = REPORT_MONTH.split("-");
  const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
  let totalCol = 0, totalDel = 0, totalDist = 0;
  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${m}-${String(d).padStart(2, "0")}`;
    const col = DATA.collections.filter((c) => c.date === ds).reduce((s, c) => s + c.amount, 0);
    const del = DATA.deliveries.filter((x) => x.date === ds).reduce((s, x) => s + x.total, 0);
    const dist = DATA.distributions.filter((x) => x.date === ds).reduce((s, x) => s + x.repAmount + x.companyAmount, 0);
    totalCol += col; totalDel += del; totalDist += dist;
    rows.push({ d, col, del, dist });
  }
  return `
    ${printHeader("Monthly Report — " + monthLabel(REPORT_MONTH), "Collection & Distribution Manager")}
    <input class="field-input no-print" type="month" style="max-width:200px;margin-bottom:14px;" value="${REPORT_MONTH}" onchange="REPORT_MONTH=this.value;renderView();">
    <div class="grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">Collections</div><div class="stat-value tone-success-text">${fmtMoney(totalCol)}</div></div>
      <div class="stat-card"><div class="stat-label">Deliveries</div><div class="stat-value tone-gold-text">${fmtMoney(totalDel)}</div></div>
      <div class="stat-card"><div class="stat-label">Distributed</div><div class="stat-value">${fmtMoney(totalDist)}</div></div>
    </div>
    <div class="panel"><h3 class="panel-title">${monthLabel(REPORT_MONTH)} — দৈনিক বিভাজন</h3>
      <table class="data-table"><thead><tr><th>Day</th><th>Collection</th><th>Delivery</th><th>Distributed</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${r.d}</td><td class="mono-num tone-success-text">${fmtMoney(r.col)}</td><td class="mono-num tone-gold-text">${fmtMoney(r.del)}</td><td class="mono-num">${fmtMoney(r.dist)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
}
function reportYearly() {
  let totalCol = 0, totalDel = 0, totalDist = 0;
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const prefix = `${REPORT_YEAR}-${String(m).padStart(2, "0")}`;
    const col = DATA.collections.filter((c) => c.date.startsWith(prefix)).reduce((s, c) => s + c.amount, 0);
    const del = DATA.deliveries.filter((x) => x.date.startsWith(prefix)).reduce((s, x) => s + x.total, 0);
    const dist = DATA.distributions.filter((x) => x.date.startsWith(prefix)).reduce((s, x) => s + x.repAmount + x.companyAmount, 0);
    totalCol += col; totalDel += del; totalDist += dist;
    rows.push({ label: monthLabel(prefix).split(" ")[0], col, del, dist });
  }
  return `
    ${printHeader("Yearly Report — " + REPORT_YEAR, "Collection & Distribution Manager")}
    <input class="field-input no-print" type="number" style="max-width:120px;margin-bottom:14px;" value="${REPORT_YEAR}" onchange="REPORT_YEAR=this.value;renderView();">
    <div class="grid" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-label">Collections</div><div class="stat-value tone-success-text">${fmtMoney(totalCol)}</div></div>
      <div class="stat-card"><div class="stat-label">Deliveries</div><div class="stat-value tone-gold-text">${fmtMoney(totalDel)}</div></div>
      <div class="stat-card"><div class="stat-label">Distributed</div><div class="stat-value">${fmtMoney(totalDist)}</div></div>
    </div>
    <div class="panel"><h3 class="panel-title">${REPORT_YEAR} — মাসিক বিভাজন</h3>
      <table class="data-table"><thead><tr><th>Month</th><th>Collection</th><th>Delivery</th><th>Distributed</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${r.label}</td><td class="mono-num tone-success-text">${fmtMoney(r.col)}</td><td class="mono-num tone-gold-text">${fmtMoney(r.del)}</td><td class="mono-num">${fmtMoney(r.dist)}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
}

/* ---------------------------------- print helper ---------------------------------- */
function printButton(label) {
  return `<button class="print-btn no-print" onclick="window.print()">🖨️ ${label || "Print"}</button>`;
}
function printHeader(title, subtitle) {
  return `<div class="print-only" style="margin-bottom:14px;">
    <h2 style="margin:0;">${esc(title)}</h2>
    <div style="font-size:12px;color:var(--muted);">${esc(subtitle || "")} — Printed on ${fmtDate(todayStr())}</div>
  </div>`;
}
function groupByDate(rows) {
  const map = {};
  rows.forEach((r) => { (map[r.date] = map[r.date] || []).push(r); });
  return Object.keys(map).sort((a, b) => (a < b ? 1 : -1)).map((date) => ({ date, rows: map[date] }));
}

/* ---------------------------------- modal + utils ---------------------------------- */
function openModal(title, bodyHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.id = "modalBackdrop";
  wrap.onclick = (e) => { if (e.target === wrap) closeModal(); };
  wrap.innerHTML = `<div class="modal-panel"><div class="modal-head"><h3 class="modal-title">${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>${bodyHtml}</div>`;
  document.body.appendChild(wrap);
}
function closeModal() { const m = document.getElementById("modalBackdrop"); if (m) m.remove(); }
function val(id) { return document.getElementById(id).value; }
function filterTable(tableId, query) {
  const rows = document.getElementById(tableId).querySelectorAll("tbody tr");
  rows.forEach((r) => { r.style.display = r.textContent.toLowerCase().includes(query.toLowerCase()) ? "" : "none"; });
}

/* ---------------------------------- persistence ---------------------------------- */
function persist() {
  render();
  if (typeof isConfigured !== "function" || !isConfigured()) return;
  SYNC_STATE = "saving";
  updateSyncPill();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveData(DATA).then(() => { SYNC_STATE = "saved"; updateSyncPill(); }).catch(() => { SYNC_STATE = "error"; updateSyncPill(); });
  }, 800);
}
function updateSyncPill() {
  const el = document.querySelector(".sync-pill");
  if (el) { el.className = "sync-pill sync-" + SYNC_STATE; el.textContent = { idle: "সংযুক্ত", saving: "সেভ হচ্ছে…", saved: "সেভ হয়েছে", error: "সেভ ব্যর্থ" }[SYNC_STATE]; }
}

/* ---------------------------------- boot ---------------------------------- */
function bootApp() {
  if (typeof isConfigured === "function" && isConfigured()) {
    loadData().then((remote) => { DATA = remote; render(); }).catch((e) => {
      document.getElementById("root").innerHTML = `<div class="app-loading">⚠️ লোড ব্যর্থ: ${esc(e.message)}<br><button class="btn-primary" onclick="location.reload()">আবার চেষ্টা করুন</button></div>`;
    });
  } else {
    DATA = seedData();
    render();
  }
}
(function init() {
  if (typeof ADMIN_PASSWORD !== "string" || !ADMIN_PASSWORD) { IS_LOGGED_IN = true; bootApp(); return; }
  if (sessionStorage.getItem("cdm_logged_in") === "1") { IS_LOGGED_IN = true; bootApp(); }
  else renderLogin();
})();
