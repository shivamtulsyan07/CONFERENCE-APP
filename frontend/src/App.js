import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { RoleProvider } from "@/context/RoleContext";
import { Shell } from "@/components/Shell";
import Dashboard from "@/pages/Dashboard";
import OrderSheet from "@/pages/OrderSheet";
import StockSheet from "@/pages/StockSheet";
import BalanceStock from "@/pages/BalanceStock";
import OrderSummary from "@/pages/OrderSummary";
import CompanyOrder from "@/pages/CompanyOrder";
import CompanyBalanceOrder from "@/pages/CompanyBalanceOrder";
import StockArrived from "@/pages/StockArrived";
import Parties from "@/pages/Parties";

function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrderSheet />} />
            <Route path="/stock" element={<StockSheet />} />
            <Route path="/summary" element={<OrderSummary />} />
            <Route path="/company-order" element={<CompanyOrder />} />
            <Route path="/company-balance" element={<CompanyBalanceOrder />} />
            <Route path="/stock-arrived" element={<StockArrived />} />
            <Route path="/balance" element={<BalanceStock />} />
            <Route path="/parties" element={<Parties />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </RoleProvider>
  );
}

export default App;
