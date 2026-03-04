import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./hooks/useAuth";
import { ProfileProvider } from "./hooks/useProfile";
import PrivateRoute from "./components/PrivateRoute";
import AdminLayout from "./components/AdminLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Reports from "./pages/Reports";
import RecurringTransactions from "./pages/RecurringTransactions";
import Settings from "./pages/Settings";

/**
 * Neden ProfileProvider PrivateRoute'un dışında?
 * ProfileProvider içinde useAuth()'tan user bilgisine erişiyor.
 * AuthProvider > ProfileProvider sıralaması gerekli.
 * PrivateRoute ise ProfileProvider'ın sağladığı needsOnboarding
 * bilgisini kullanarak onboarding/uygulama ayrımını yapıyor.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<PrivateRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/recurring" element={<RecurringTransactions />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
          <Analytics />
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
