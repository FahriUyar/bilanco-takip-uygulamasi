import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTenant } from "../hooks/useTenant";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  BarChart3,
  RefreshCw,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Özet", icon: LayoutDashboard },
  { to: "/transactions", label: "İşlemler", icon: ArrowLeftRight },
  { to: "/categories", label: "Kategoriler", icon: Tags },
  { to: "/reports", label: "Raporlar", icon: BarChart3 },
  { to: "/recurring", label: "Otomatik İşlemler", icon: RefreshCw },
];

export default function AdminLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Neden useTenant? Tüm marka bilgisi (isim, ikon, renkler) tek yerden gelsin.
  // CSS custom properties bu hook içinde güncelleniyor, bu yüzden burada
  // çağırmak yeterli — tüm uygulama doğru renkle render edilir.
  const tenant = useTenant();
  const TenantIcon = tenant.Icon;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-sidebar flex flex-col transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo — domain'e göre dinamik isim ve ikon */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <TenantIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              {tenant.appName}
            </h1>
            <p className="text-white/50 text-xs">{tenant.subtitle}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary-600 text-white shadow-md"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="px-3 pb-4 space-y-2">
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-white/40 text-xs">Giriş yapan</p>
            <p className="text-white/80 text-sm font-medium truncate">
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-danger-600/20 hover:text-danger-500 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Mobile) — domain'e göre dinamik */}
        <header className="h-16 flex items-center gap-4 px-4 lg:px-8 bg-card border-b border-border lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-text-secondary hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <TenantIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-text-primary">
              {tenant.appName}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="px-4 lg:px-8 py-4 border-t border-border bg-card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
            <span>
              &copy; {new Date().getFullYear()}{" "}
              <span className="font-semibold text-text-secondary">
                {tenant.appName}
              </span>{" "}
              &mdash; Tüm hakları saklıdır.
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
              Güvenli bağlantı &bull; Veriler Şifreli
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
