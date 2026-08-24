import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/context/RoleContext";
import { Shell } from "@/components/Shell";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import CompanyOrders from "@/pages/CompanyOrders";
import Dispatch from "@/pages/Dispatch";
import Inventory from "@/pages/Inventory";
import Parties from "@/pages/Parties";

function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/company-orders" element={<CompanyOrders />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/parties" element={<Parties />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </RoleProvider>
  );
}

export default App;
