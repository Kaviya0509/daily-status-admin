import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "@/services/authService";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  Table2,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: "/tracker", label: "Daily Tracker", icon: Table2, badge: "Live" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const isActive = (path: string) => {
    if (path === "/tracker") {
      return location.pathname.startsWith("/tracker") || location.pathname.startsWith("/reports");
    }
    return location.pathname === path;
  };

  const displayName = userProfile?.displayName || user?.displayName || "Admin User";
  const email = userProfile?.email || user?.email || "admin@system.local";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AD";

  const getPageTitle = () => {
    if (location.pathname.startsWith("/reports")) return "Report Details";
    if (location.pathname.startsWith("/tracker")) return "Daily Tracker";
    return "Admin Portal";
  };

  return (
    <div className="min-h-screen flex bg-[#F8F7FC] text-slate-900 font-sans antialiased">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-64 lg:w-72 h-screen bg-white text-slate-800 flex flex-col border-r border-slate-200/90 shadow-sm transition-transform duration-200 ease-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#C084FC] p-0.5 shadow-md shadow-purple-500/20 flex items-center justify-center">
              <div className="h-full w-full bg-white/10 backdrop-blur-xs rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-900">Mentee</span>
                <span className="text-xs uppercase tracking-wider font-bold text-[#7C3AED] bg-[#F3E8FF] px-2 py-0.5 rounded-md border border-[#E9D4FF]">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">Daily Status Tracker</p>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="px-3.5 py-5 flex-1 overflow-y-auto space-y-6">
          <div>
            <div className="px-3 pb-2.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Management
            </div>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                      active
                        ? "bg-[#F3E8FF]/90 text-[#7C3AED] font-semibold border-l-4 border-[#7C3AED] shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-lg transition-colors ${
                          active
                            ? "bg-[#7C3AED] text-white shadow-xs shadow-purple-500/30"
                            : "bg-slate-100 text-slate-500 group-hover:text-slate-800 group-hover:bg-slate-200/80"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                        active
                          ? "bg-[#E9D4FF] text-purple-900 border border-purple-200"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80"
                      }`}
                    >
                      {item.badge}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Card & Sign Out */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200/80 mb-2 shadow-xs">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-[#7C3AED] to-[#A855F7] flex items-center justify-center font-bold text-xs text-white shadow-xs">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Online" />
              </div>
              <p className="text-[11px] text-slate-500 truncate">{email}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-2 text-slate-400 group-hover:text-rose-500" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb & Title */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>Admin</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
                <span className="text-[#7C3AED] font-bold">{getPageTitle()}</span>
              </div>
            </div>
          </div>

          {/* Right Top Header Info */}
          <div className="flex items-center gap-3">
            {/* Live indicator badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3E8FF] border border-[#E9D4FF] text-[11px] font-semibold text-[#7C3AED]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]"></span>
              </span>
              <span>Live Synced</span>
            </div>

            {/* Current Date Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>{format(new Date(), "EEE, MMM d, yyyy")}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
