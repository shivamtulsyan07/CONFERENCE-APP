import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const http = axios.create({ baseURL: API });

export const api = {
  parties: () => http.get("/parties").then((r) => r.data),
  createParty: (d) => http.post("/parties", d).then((r) => r.data),
  deleteParty: (id) => http.delete(`/parties/${id}`).then((r) => r.data),

  orderRows: () => http.get("/order-rows").then((r) => r.data),
  saveOrderRows: (rows) => http.post("/order-rows/bulk", { rows }).then((r) => r.data),
  replaceOrderRows: (rows) => http.post("/order-rows/replace", { rows }).then((r) => r.data),
  deleteOrderRow: (id) => http.delete(`/order-rows/${id}`).then((r) => r.data),
  autoStatus: () => http.post("/order-rows/auto-status").then((r) => r.data),

  stockRows: () => http.get("/stock-rows").then((r) => r.data),
  saveStockRows: (rows) => http.post("/stock-rows/bulk", { rows }).then((r) => r.data),
  replaceStockRows: (rows) => http.post("/stock-rows/replace", { rows }).then((r) => r.data),
  deleteStockRow: (id) => http.delete(`/stock-rows/${id}`).then((r) => r.data),

  lookups: () => http.get("/lookups").then((r) => r.data),
  balanceStock: () => http.get("/balance-stock").then((r) => r.data),
  extraStock: () => http.get("/extra-stock").then((r) => r.data),
  orderSummary: () => http.get("/order-summary").then((r) => r.data),
  companyOrder: (pendingOnly = false) =>
    http.get("/company-order", { params: { pending_only: pendingOnly } }).then((r) => r.data),

  lineRows: (sheet) => http.get(`/line-sheet/${sheet}`).then((r) => r.data),
  saveLineRows: (sheet, rows) => http.post(`/line-sheet/${sheet}/bulk`, { rows }).then((r) => r.data),
  replaceLineRows: (sheet, rows) => http.post(`/line-sheet/${sheet}/replace`, { rows }).then((r) => r.data),
  deleteLineRow: (sheet, id) => http.delete(`/line-sheet/${sheet}/${id}`).then((r) => r.data),
  companyBalance: () => http.get("/company-balance").then((r) => r.data),
  stats: () => http.get("/stats/dashboard").then((r) => r.data),
  overview: (params = {}) => http.get("/stats/overview", { params }).then((r) => r.data),
  assistantHistory: (sid) => http.get(`/assistant/history/${sid}`).then((r) => r.data),
  seed: () => http.post("/seed").then((r) => r.data),
};

export const errMsg = (e) =>
  e?.response?.data?.detail || e?.message || "Something went wrong";

export const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const STATUS_META = {
  not_ready: { label: "Not ready", color: "#FFFFFF", text: "Stock not ready" },
  arrived: { label: "Arrived", color: "#FFF176", text: "Stock has arrived" },
  ready: { label: "In stock ready", color: "#7CAE5C", text: "In stock, ready" },
};
