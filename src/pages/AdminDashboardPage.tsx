import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  getDashboardStats,
  getAllReports,
  getActiveMentees,
} from "@/services/reportService";
import type { DashboardStats, MenteeReport, UserProfile } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileText,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Sparkles,
  Eye,
  UserX,
  Check,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayReports, setTodayReports] = useState<MenteeReport[]>([]);
  const [activeMentees, setActiveMentees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const today = format(new Date(), "yyyy-MM-dd");

  const loadData = async () => {
    try {
      setLoading(true);

      const [statsData, reportsData, menteesData] = await Promise.all([
        getDashboardStats(today),
        getAllReports(
          {
            search: "",
            startDate: today,
            endDate: today,
            menteeUid: "",
            status: "",
          },
          20
        ),
        getActiveMentees(),
      ]);

      setStats(statsData);
      setTodayReports(reportsData.reports || []);
      setActiveMentees(menteesData || []);
      setError("");
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard statistics. Please verify your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [today]);

  // Compute missing mentees list
  const submittedMenteeUids = new Set(todayReports.map((r) => r.menteeUid));
  const missingMentees = activeMentees.filter(
    (m) => !submittedMenteeUids.has(m.uid)
  );

  // Compute blocked reports for quick attention
  const blockedReports = todayReports.filter((r) => r.status === "Blocked");

  // Percentage submitted
  const submissionRate =
    stats && stats.totalActiveMentees > 0
      ? Math.round((stats.reportsSubmittedToday / stats.totalActiveMentees) * 100)
      : 0;

  const statCards = stats
    ? [
        {
          title: "Total Active Mentees",
          value: stats.totalActiveMentees,
          subtitle: "Registered in roster",
          icon: Users,
          iconColor: "text-[#7C3AED]",
          bgColor: "bg-purple-50",
          iconBorder: "border-purple-200/80",
          accentBar: "bg-gradient-to-r from-[#7C3AED] to-[#A855F7]",
          borderColor: "hover:border-[#7C3AED]/40",
          gradient: "from-purple-500/5 via-transparent to-transparent",
          badgeColor: "bg-purple-100 text-[#7C3AED]",
          filter: "",
        },
        {
          title: "Submitted Today",
          value: stats.reportsSubmittedToday,
          subtitle: `${submissionRate}% completion rate`,
          icon: FileText,
          iconColor: "text-emerald-600",
          bgColor: "bg-emerald-50",
          iconBorder: "border-emerald-200/80",
          accentBar: "bg-gradient-to-r from-emerald-500 to-teal-500",
          borderColor: "hover:border-emerald-500/40",
          gradient: "from-emerald-500/5 via-transparent to-transparent",
          badge: submissionRate === 100 && stats.reportsSubmittedToday > 0 ? "100%" : undefined,
          badgeColor: "bg-emerald-100 text-emerald-700",
          filter: `startDate=${today}&endDate=${today}`,
        },
        {
          title: "In Progress",
          value: stats.inProgress,
          subtitle: "Tasks currently underway",
          icon: PlayCircle,
          iconColor: "text-sky-600",
          bgColor: "bg-sky-50",
          iconBorder: "border-sky-200/80",
          accentBar: "bg-gradient-to-r from-sky-500 to-indigo-500",
          borderColor: "hover:border-sky-500/40",
          gradient: "from-sky-500/5 via-transparent to-transparent",
          badgeColor: "bg-sky-100 text-sky-700",
          filter: `startDate=${today}&endDate=${today}&status=In Progress`,
        },
        {
          title: "Blocked Issues",
          value: stats.blocked,
          subtitle: stats.blocked > 0 ? "Requires assistance" : "No active blockers",
          icon: AlertTriangle,
          iconColor: stats.blocked > 0 ? "text-rose-600 animate-pulse" : "text-rose-600",
          bgColor: "bg-rose-50",
          iconBorder: "border-rose-200/80",
          accentBar: "bg-gradient-to-r from-rose-500 to-red-500",
          borderColor: "hover:border-rose-500/40",
          gradient: "from-rose-500/5 via-transparent to-transparent",
          badge: stats.blocked > 0 ? "Priority" : undefined,
          badgeColor: "bg-rose-100 text-rose-700 animate-pulse",
          filter: `startDate=${today}&endDate=${today}&status=Blocked`,
        },
        {
          title: "Completed Today",
          value: stats.completed,
          subtitle: "Successfully finished",
          icon: CheckCircle2,
          iconColor: "text-teal-600",
          bgColor: "bg-teal-50",
          iconBorder: "border-teal-200/80",
          accentBar: "bg-gradient-to-r from-teal-500 to-emerald-500",
          borderColor: "hover:border-teal-500/40",
          gradient: "from-teal-500/5 via-transparent to-transparent",
          badgeColor: "bg-teal-100 text-teal-700",
          filter: `startDate=${today}&endDate=${today}&status=Completed`,
        },
        {
          title: "Pending Submission",
          value: stats.missingToday,
          subtitle: "Awaiting today's report",
          icon: AlertCircle,
          iconColor: "text-amber-600",
          bgColor: "bg-amber-50",
          iconBorder: "border-amber-200/80",
          accentBar: "bg-gradient-to-r from-amber-400 to-orange-400",
          borderColor: "hover:border-amber-500/40",
          gradient: "from-amber-500/5 via-transparent to-transparent",
          badgeColor: "bg-amber-100 text-amber-700",
          filter: "",
        },
      ]
    : [];

  const handleCardClick = (filter: string) => {
    navigate(`/tracker${filter ? `?${filter}` : ""}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
            Completed
          </Badge>
        );
      case "In Progress":
        return (
          <Badge className="bg-sky-50 text-sky-700 border-sky-200 font-medium">
            In Progress
          </Badge>
        );
      case "Blocked":
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-medium">
            Blocked
          </Badge>
        );
      case "On Hold":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium">
            On Hold
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-medium">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Modern Light Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FAF5FF] via-white to-[#F5F3FF] text-slate-900 p-6 sm:p-8 shadow-sm border border-purple-200/80">
        {/* Ambient lilac background decoration */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-gradient-to-bl from-[#E9D4FF]/40 via-purple-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-indigo-100/40 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3E8FF] border border-[#E9D4FF] text-[#7C3AED] text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Executive Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Mentee Daily Status Dashboard
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Real-time workspace for <span className="text-slate-900 font-semibold">{format(new Date(), "EEEE, MMMM d, yyyy")}</span>.
              Review mentee deliverables, resolve blockers, and track daily progress.
            </p>

          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap lg:flex-col gap-2.5 shrink-0">
            <Button
              className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white font-semibold shadow-md shadow-purple-500/25 border-0 cursor-pointer"
              onClick={() => navigate(`/tracker?startDate=${today}&endDate=${today}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              View Today's Tracker
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="outline" size="sm" onClick={() => loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden bg-white">
                <div className="h-1 bg-slate-200 w-full" />
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-8 rounded-xl" />
                  </div>
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className={`group relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${card.borderColor} flex flex-col justify-between`}
                  onClick={() => handleCardClick(card.filter)}
                >
                  {/* Top Colored Status Accent Bar */}
                  <div className={`h-1 w-full ${card.accentBar}`} />

                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
                  />

                  <div className="p-4 relative z-10 flex-1 flex flex-col justify-between space-y-3">
                    {/* Top Row: Category Icon & Drill-down Action / Badge */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`p-2 rounded-xl ${card.bgColor} ${card.iconColor} border ${card.iconBorder} transition-transform duration-200 group-hover:scale-110 shadow-2xs shrink-0`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {card.badge ? (
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${card.badgeColor}`}
                        >
                          {card.badge}
                        </span>
                      ) : (
                        <div className="flex items-center gap-0.5 text-slate-300 group-hover:text-[#7C3AED] transition-colors text-[10px] font-semibold">
                          <span>Filter</span>
                          <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      )}
                    </div>

                    {/* Middle: Number & Title */}
                    <div className="space-y-0.5">
                      <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-sans">
                        {card.value}
                      </div>
                      <div className="text-xs font-bold text-slate-700 tracking-tight leading-snug">
                        {card.title}
                      </div>
                    </div>

                    {/* Footer Row: Context subtitle */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate font-medium">{card.subtitle}</span>
                      {card.badge && (
                        <ArrowUpRight className="h-3 w-3 text-slate-300 group-hover:text-[#7C3AED] shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Two-Column Actionable Center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Urgent Blockers & Escalations */}
        <Card className="border border-slate-200/80 shadow-xs rounded-2xl bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Active Blockers
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Tasks flagged as Blocked needing mentor or lead assistance
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={blockedReports.length > 0 ? "destructive" : "secondary"}
                className="font-bold text-xs"
              >
                {blockedReports.length} {blockedReports.length === 1 ? "Blocker" : "Blockers"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : blockedReports.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">
                  No Active Blockers Today
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  All submitted reports show mentees progressing without critical obstacles.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedReports.map((report) => (
                  <div
                    key={report.reportId}
                    className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-50/70 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {report.menteeName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Lead: {report.managerLead || "Unassigned"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-rose-900 truncate">
                        {report.currentTask}
                      </p>
                      <p className="text-xs text-rose-700/90 line-clamp-2">
                        <span className="font-medium">Blocker: </span>
                        {report.blockerDependency || "No blocker details provided"}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-300 text-rose-700 hover:bg-rose-100 text-xs shrink-0"
                      onClick={() => navigate(`/reports/${report.reportId}`)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Today's Recent Reports Stream */}
        <Card className="border border-slate-200/80 shadow-xs rounded-2xl bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#F3E8FF] text-[#7C3AED]">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Today's Activity Stream
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Latest submissions received today
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#7C3AED] hover:text-[#6D28D9] hover:bg-purple-50 font-semibold"
                onClick={() => navigate(`/tracker?startDate=${today}&endDate=${today}`)}
              >
                View all ({todayReports.length})
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 flex-1">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : todayReports.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">
                  No Reports Submitted Yet Today
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Submissions will appear here in real-time as mentees check in.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {todayReports.slice(0, 5).map((report) => (
                  <div
                    key={report.reportId}
                    className="p-3 rounded-xl border border-slate-200/70 hover:border-[#E9D4FF] hover:bg-purple-50/20 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => navigate(`/reports/${report.reportId}`)}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {report.menteeName}
                        </span>
                        {getStatusBadge(report.status)}
                      </div>
                      <p className="text-xs text-slate-600 truncate font-medium">
                        {report.currentTask}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {report.shortDescription}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-[#7C3AED] hover:bg-purple-50 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/reports/${report.reportId}`);
                      }}
                      title="Inspect Report"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Missing Submissions Watchlist */}
      {missingMentees.length > 0 && (
        <Card className="border border-amber-200/80 bg-amber-50/30 rounded-2xl shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <UserX className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Pending Reports Watchlist ({missingMentees.length})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Active mentees who have not submitted a report for {format(new Date(), "MMMM d")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {missingMentees.map((mentee) => (
                <div
                  key={mentee.uid}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-medium text-slate-700 shadow-xs"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>{mentee.displayName || mentee.email}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
