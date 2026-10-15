import { useLocation, useNavigate } from "react-router-dom";
import { signOut } from "@/services/authService";
import { format } from "date-fns";
import {
  ShieldCheck,
  Calendar,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const getPageTitle = () => {
    if (location.pathname.startsWith("/reports")) return "Report Details";
    if (location.pathname.startsWith("/tracker")) return "Daily Tracker";
    return "Admin Portal";
  };

  return (
    <div className="relative min-h-screen flex flex-col text-slate-900 font-sans antialiased">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-45 -z-10" style={{ backgroundImage: "url('/admin-bg.png')" }} />
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 lg:px-10 py-3.5 flex items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#C084FC] p-0.5 shadow-md shadow-purple-500/20 flex items-center justify-center shrink-0">
            <div className="h-full w-full bg-white/10 backdrop-blur-xs rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900">Admin</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span>Admin</span>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span className="text-[#7C3AED] font-semibold">{getPageTitle()}</span>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3E8FF] border border-[#E9D4FF] text-[11px] font-semibold text-[#7C3AED]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C3AED]"></span>
            </span>
            <span>Live Synced</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100/80 border border-slate-200/80 text-xs font-semibold text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>{format(new Date(), "EEE, MMM d, yyyy")}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 border-slate-200 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full animate-in fade-in duration-200">
        {children}
      </main>
    </div>
  );
}
