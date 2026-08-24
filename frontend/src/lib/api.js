import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const http = axios.create({ baseURL: API });

export const api = {
  parties: () => http.get("/parties").then((r) => r.data),
  createParty: (d) => http.post("/parties", d).then((r) => r.data),
  deleteParty: (id) => http.delete(`/parties/${id}`).then((r) => r.data),

  products: () => http.get("/products").then((r) => r.data),
  createProduct: (d) => http.post("/products", d).then((r) => r.data),
  adjustStock: (id, d) => http.patch(`/products/${id}/stock`, d).then((r) => r.data),
  deleteProduct: (id) => http.delete(`/products/${id}`).then((r) => r.data),

  orders: () => http.get("/orders").then((r) => r.data),
  createOrder: (d) => http.post("/orders", d).then((r) => r.data),
  deleteOrder: (id) => http.delete(`/orders/${id}`).then((r) => r.data),

  companyOrders: () => http.get("/company-orders").then((r) => r.data),
  createCompanyOrder: (d) => http.post("/company-orders", d).then((r) => r.data),
  receiveCompanyOrder: (id, d) => http.post(`/company-orders/${id}/receive`, d).then((r) => r.data),

  dispatches: () => http.get("/dispatches").then((r) => r.data),
  createDispatch: (d) => http.post("/dispatches", d).then((r) => r.data),

  stats: () => http.get("/stats/dashboard").then((r) => r.data),
  seed: () => http.post("/seed").then((r) => r.data),
};

export const errMsg = (e) =>
  e?.response?.data?.detail || e?.message || "Something went wrong";

export const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const STATUS_LABEL = {
  pending: "Pending",
  ordered_to_company: "Ordered to Company",
  received: "Received in Shop",
  partial: "Partly Dispatched",
  dispatched: "Dispatched",
};
