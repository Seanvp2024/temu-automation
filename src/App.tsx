import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/Layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import AccountManager from "./pages/AccountManager";
import ProductList from "./pages/ProductList";
import OrderList from "./pages/OrderList";
import SalesManagement from "./pages/SalesManagement";
import Analytics from "./pages/Analytics";
import TaskManager from "./pages/TaskManager";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="accounts" element={<AccountManager />} />
        <Route path="products" element={<ProductList />} />
        <Route path="sales" element={<SalesManagement />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="tasks" element={<TaskManager />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
