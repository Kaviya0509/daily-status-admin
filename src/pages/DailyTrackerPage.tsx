import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { format, startOfWeek, endOfWeek, parseISO, subDays, startOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  getAllReports,
  getActiveMentees,
  subscribeToReports,
  formatNameFromEmail,
} from "@/services/reportService";
import { getReportsForExport } from "@/services/reportService";
import { exportToExcel, generateExportFilename } from "@/services/excelExportService";
import type { MenteeReport, ReportFilters, ReportStatus, UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  RotateCcw,
  Eye,
  Pencil,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Calendar,
  AlertTriangle,
  X,
  Filter,
  FileSpreadsheet,
  Download,
  RefreshCw,
  User,
  Mail,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "cn";

const statusOptions: ReportStatus[] = [
  "Not Started",
  "In Progress",
  "Blocked",
  "Completed",
  "On Hold",
];

function getMenteeAvatarColor(name: string): string {
  const colors = [
    "bg-blue-600 text-white",
    "bg-emerald-600 text-white",
    "bg-purple-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-cyan-600 text-white",
    "bg-indigo-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function renderStatusBadge(status: ReportStatus) {
  switch (status) {
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          Completed
        </span>
      );
    case "In Progress":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
          In Progress
        </span>
      );
    case "Blocked":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
          Blocked
        </span>
      );
    case "On Hold":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
          On Hold
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
          {status}
        </span>
      );
  }
}

function truncate(text: string, maxLength: number = 45): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function getWeekHeading(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    return `Week of ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
  } catch {
    return "";
  }
}

export default function DailyTrackerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [rawReports, setRawReports] = useState<MenteeReport[]>([]);
  const [mentees, setMentees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewReport, setPreviewReport] = useState<MenteeReport | null>(null);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "reportDate", desc: true },
  ]);
  const [pageSize, setPageSize] = useState(25);

  const [filters, setFilters] = useState<ReportFilters>({
    search: searchParams.get("search") ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    menteeUid: searchParams.get("menteeUid") ?? searchParams.get("mentee") ?? "",
    status: (searchParams.get("status") as ReportStatus | "") ?? "",
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const yesterdayStr = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const syncMenteesFromReports = useCallback(
    (reportsList: MenteeReport[], existingMentees: UserProfile[]) => {
      const map = new Map<string, UserProfile>();

      existingMentees.forEach((m) => {
        const rawName = (m.displayName || "").trim();
        const cleanName =
          rawName && !rawName.includes("@")
            ? rawName
            : formatNameFromEmail(m.email || m.uid);
        map.set(m.uid, {
          ...m,
          displayName: cleanName || "Mentee",
        });
      });

      reportsList.forEach((r) => {
        const uid = r.menteeUid || r.menteeEmail;
        if (!uid) return;
        const reportName = (r.menteeName || "").trim();
        const validReportName =
          reportName && !reportName.includes("@") ? reportName : "";

        if (map.has(uid)) {
          const existing = map.get(uid)!;
          if (
            validReportName &&
            (!existing.displayName ||
              existing.displayName.includes("@") ||
              existing.displayName === "Mentee")
          ) {
            existing.displayName = validReportName;
          }
          if (!existing.email && r.menteeEmail) {
            existing.email = r.menteeEmail;
          }
        } else {
          map.set(uid, {
            uid,
            displayName:
              validReportName ||
              formatNameFromEmail(r.menteeEmail || uid) ||
              "Mentee",
            email: r.menteeEmail || "",
            role: "mentee",
            active: true,
          });
        }
      });

      return Array.from(map.values()).sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "")
      );
    },
    []
  );

  const loadData = useCallback(async () => {
    try {
      const [fetchedReportsResult, activeMentees] = await Promise.all([
        getAllReports({ search: "", startDate: "", endDate: "", menteeUid: "", status: "" }, 500),
        getActiveMentees(),
      ]);
      setRawReports(fetchedReportsResult.reports);
      setMentees(syncMenteesFromReports(fetchedReportsResult.reports, activeMentees));
    } catch (err) {
      console.error("Error loading reports and mentees:", err);
    }
  }, [syncMenteesFromReports]);

  // Real-time Firestore subscription + initial fetch
  useEffect(() => {
    setLoading(true);

    // Initial fetch to guarantee data is present immediately
    loadData().finally(() => setLoading(false));

    // Real-time listener for live updates from any submitted mentee report
    const unsubscribe = subscribeToReports(
      (incomingReports) => {
        setRawReports(incomingReports);
        setMentees((prev) => syncMenteesFromReports(incomingReports, prev));
        setLoading(false);
      },
      (err) => {
        console.warn("Firestore real-time subscription error, using one-time fetch:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [loadData, syncMenteesFromReports]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  // Dynamic client-side filtering and sorting from live Firestore data
  const reports = useMemo(() => {
    return rawReports.filter((r) => {
      if (filters.startDate && r.reportDate < filters.startDate) return false;
      if (filters.endDate && r.reportDate > filters.endDate) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.menteeUid && r.menteeUid !== filters.menteeUid) return false;
      if (filters.search) {
        const qLower = filters.search.toLowerCase().trim();
        const match =
          (r.menteeName && r.menteeName.toLowerCase().includes(qLower)) ||
          (r.menteeEmail && r.menteeEmail.toLowerCase().includes(qLower)) ||
          (r.currentTask && r.currentTask.toLowerCase().includes(qLower)) ||
          (r.shortDescription && r.shortDescription.toLowerCase().includes(qLower)) ||
          (r.managerLead && r.managerLead.toLowerCase().includes(qLower));
        if (!match) return false;
      }
      return true;
    });
  }, [rawReports, filters]);

  // Sync URL query params with state
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (filters.search) newParams.set("search", filters.search);
    if (filters.startDate) newParams.set("startDate", filters.startDate);
    if (filters.endDate) newParams.set("endDate", filters.endDate);
    if (filters.menteeUid) newParams.set("menteeUid", filters.menteeUid);
    if (filters.status) newParams.set("status", filters.status);
    setSearchParams(newParams, { replace: true });
  }, [filters, setSearchParams]);

  const handleResetFilters = () => {
    setFilters({
      search: "",
      startDate: "",
      endDate: "",
      menteeUid: "",
      status: "",
    });
  };

  const handleExport = async (exportType: "range" | "today" | "all" | "filtered" = "range") => {
    setExporting(true);
    try {
      let exportFilters = { ...filters };

      if (exportType === "today") {
        exportFilters = { search: "", startDate: todayStr, endDate: todayStr, menteeUid: "", status: "" };
      } else if (exportType === "all") {
        exportFilters = { search: "", startDate: "", endDate: "", menteeUid: "", status: "" };
      } else {
        // "range" or "filtered"
        exportFilters = { ...filters };
      }

      const allReports = await getReportsForExport(exportFilters);
      if (!allReports || allReports.length === 0) {
        toast.info("No reports found matching the selected date criteria to export.");
        return;
      }
      const filename = generateExportFilename(exportFilters);
      exportToExcel(allReports, filename);
      const rangeDesc = exportFilters.startDate && exportFilters.endDate
        ? ` (${exportFilters.startDate} to ${exportFilters.endDate})`
        : exportFilters.startDate
        ? ` (from ${exportFilters.startDate})`
        : "";
      toast.success(`Exported ${allReports.length} report${allReports.length === 1 ? "" : "s"} to Excel${rangeDesc}!`);
    } catch (err) {
      console.error("Error exporting:", err);
      toast.error("Failed to export Excel file. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Group reports by week
  const weekGroups = useMemo(() => {
    const groups: Record<string, MenteeReport[]> = {};
    for (const report of reports) {
      const weekKey = getWeekHeading(report.reportDate);
      if (!groups[weekKey]) {
        groups[weekKey] = [];
      }
      groups[weekKey].push(report);
    }
    return groups;
  }, [reports]);

  const columns: ColumnDef<MenteeReport, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "reportDate",
        header: "Date",
        cell: (info) => (
          <div className="font-semibold text-xs text-slate-800 whitespace-nowrap">
            {(info.row.original as MenteeReport).reportDate}
          </div>
        ),
        size: 105,
      },
      {
        accessorKey: "menteeName",
        header: "Mentee",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          const initials = report.menteeName
            ? report.menteeName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
            : "M";
          return (
            <div className="flex items-center gap-2.5">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs ${getMenteeAvatarColor(
                  report.menteeName
                )}`}
              >
                {initials}
              </div>
              <span className="text-sm font-semibold text-slate-900 truncate">
                {report.menteeName}
              </span>
            </div>
          );
        },
        size: 170,
      },
      {
        accessorKey: "currentTask",
        header: "Current Task",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          return (
            <span className="text-xs font-semibold text-slate-900" title={report.currentTask}>
              {truncate(report.currentTask, 38)}
            </span>
          );
        },
        size: 180,
      },
      {
        accessorKey: "shortDescription",
        header: "Description",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          return (
            <span className="text-xs text-slate-600" title={report.shortDescription}>
              {truncate(report.shortDescription, 40)}
            </span>
          );
        },
        size: 200,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          return renderStatusBadge(report.status);
        },
        size: 125,
      },
      {
        accessorKey: "blockerDependency",
        header: "Blocker / Dependency",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          const hasBlocker = report.blockerDependency && report.blockerDependency.trim().length > 0;
          return (
            <div className="flex items-center gap-1.5">
              {hasBlocker && (
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              )}
              <span
                className={`text-xs ${hasBlocker ? "font-medium text-rose-700" : "text-slate-400"}`}
                title={report.blockerDependency}
              >
                {hasBlocker ? truncate(report.blockerDependency, 35) : "—"}
              </span>
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: "expectedCompletion",
        header: "Target Date",
        cell: (info) => {
          const val = (info.row.original as MenteeReport).expectedCompletion;
          return (
            <span className="text-xs text-slate-600 whitespace-nowrap">
              {val || "—"}
            </span>
          );
        },
        size: 110,
      },
      {
        accessorKey: "idleReasonWorkNeeded",
        header: "Idle Reason / Support",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          const hasReason = report.idleReasonWorkNeeded && report.idleReasonWorkNeeded.trim().length > 0;
          return (
            <span
              className={`text-xs ${hasReason ? "font-medium text-amber-700" : "text-slate-400"}`}
              title={report.idleReasonWorkNeeded}
            >
              {hasReason ? truncate(report.idleReasonWorkNeeded, 35) : "—"}
            </span>
          );
        },
        size: 170,
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          const hasNotes = report.notes && report.notes.trim().length > 0;
          return (
            <span
              className={`text-xs ${hasNotes ? "text-slate-700" : "text-slate-400"}`}
              title={report.notes}
            >
              {hasNotes ? truncate(report.notes, 35) : "—"}
            </span>
          );
        },
        size: 160,
      },
      {
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const report = info.row.original as MenteeReport;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-500 hover:text-[#7C3AED] hover:bg-purple-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewReport(report);
                }}
                title="Quick View"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/reports/${report.reportId}?edit=true`);
                }}
                title="Edit Report"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
        size: 90,
      },
    ],
    [navigate]
  );

  const table = useReactTable({
    data: reports,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedMentee = mentees.find((m) => m.uid === filters.menteeUid);
  const selectedMenteeName = selectedMentee
    ? (selectedMentee.displayName && !selectedMentee.displayName.includes("@")
        ? selectedMentee.displayName
        : formatNameFromEmail(selectedMentee.email || selectedMentee.uid))
    : (filters.menteeUid && filters.menteeUid !== "all"
        ? formatNameFromEmail(filters.menteeUid)
        : "");
  const isAnyFilterActive = Boolean(
    filters.search || filters.startDate || filters.endDate || filters.menteeUid || filters.status
  );


  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Daily Status Tracker
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time multi-mentee submission feed with granular filters and audit trails
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-9 px-3.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh reports"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin text-[#7C3AED]" : "text-slate-500"}`} />
            Refresh
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={exporting}
              className="inline-flex items-center justify-center rounded-xl text-xs font-semibold h-9 px-3.5 border border-[#E9D4FF] text-[#7C3AED] bg-white hover:bg-purple-50 hover:text-[#6D28D9] shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              )}
              {filters.startDate || filters.endDate ? "Export Range Excel" : "Export Excel"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(filters.startDate || filters.endDate) && (
                <DropdownMenuItem onClick={() => handleExport("range")} className="font-semibold text-[#7C3AED] bg-purple-50/70 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-[#7C3AED]" />
                  Export Date Range ({filters.startDate || "Start"} → {filters.endDate || "Today"})
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleExport("today")} className="cursor-pointer">
                <Calendar className="h-4 w-4 mr-2 text-slate-500" />
                Export Today Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("filtered")} className="cursor-pointer">
                <Filter className="h-4 w-4 mr-2 text-slate-500" />
                Export Current Filters ({reports.length} reports)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("all")} className="cursor-pointer">
                <Download className="h-4 w-4 mr-2 text-slate-500" />
                Export All History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          {/* Search Input */}
          <div className="sm:col-span-2 lg:col-span-3 relative">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-[#7C3AED]" />
              Search Content
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search by mentee name, task, description..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="pl-10 pr-9 h-10 text-xs rounded-xl border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all shadow-2xs font-medium"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mentee Select */}
          <div className="sm:col-span-1 lg:col-span-3">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-[#7C3AED]" />
              Mentee
            </label>
            <Select
              value={filters.menteeUid || "all"}
              onValueChange={(val: string | null) =>
                setFilters((f) => ({
                  ...f,
                  menteeUid: !val || val === "all" ? "" : val,
                }))
              }
            >
              <SelectTrigger className="w-full h-10 text-xs rounded-xl border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/15 transition-all shadow-2xs font-medium px-3">
                <span className="flex-1 text-left truncate text-slate-800">
                  {filters.menteeUid && filters.menteeUid !== "all"
                    ? selectedMenteeName || "Selected Mentee"
                    : "All Mentees"}
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 shadow-lg min-w-48">
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="font-semibold text-slate-900">All Mentees ({mentees.length})</span>
                  </div>
                </SelectItem>
                {mentees.map((m) => {
                  const label =
                    m.displayName && !m.displayName.includes("@")
                      ? m.displayName
                      : formatNameFromEmail(m.email || m.uid);
                  return (
                    <SelectItem key={m.uid} value={m.uid}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-md bg-[#F3E8FF] text-[#7C3AED] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {label[0]?.toUpperCase() || "M"}
                        </div>
                        <span className="font-medium text-slate-800 truncate">{label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Status Select */}
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#7C3AED]" />
              Status
            </label>
            <Select
              value={filters.status || "all"}
              onValueChange={(val: string | null) =>
                setFilters((f) => ({
                  ...f,
                  status: !val || val === "all" ? "" : (val as ReportStatus),
                }))
              }
            >
              <SelectTrigger className="w-full h-10 text-xs rounded-xl border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#7C3AED]/40 focus:ring-2 focus:ring-[#7C3AED]/15 transition-all shadow-2xs font-medium px-3">
                <span className="flex-1 text-left truncate text-slate-800">
                  {filters.status ? filters.status : "All Statuses"}
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 shadow-lg min-w-44">
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="font-semibold text-slate-900">All Statuses</span>
                  </div>
                </SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          s === "Completed" && "bg-emerald-500",
                          s === "In Progress" && "bg-sky-500",
                          s === "Blocked" && "bg-rose-500",
                          s === "On Hold" && "bg-amber-500",
                          s === "Not Started" && "bg-slate-400"
                        )}
                      />
                      <span className="font-medium text-slate-800">{s}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Date */}
          <div className="sm:col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#7C3AED]" />
                From Date
              </label>
              {filters.startDate && (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, startDate: "" }))}
                  className="text-[10px] text-slate-400 hover:text-rose-500 cursor-pointer font-medium"
                  title="Clear start date"
                >
                  Clear
                </button>
              )}
            </div>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all shadow-2xs font-medium px-3"
            />
          </div>

          {/* To Date */}
          <div className="sm:col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#7C3AED]" />
                To Date
              </label>
              {filters.endDate && (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, endDate: "" }))}
                  className="text-[10px] text-slate-400 hover:text-rose-500 cursor-pointer font-medium"
                  title="Clear end date"
                >
                  Clear
                </button>
              )}
            </div>
            <Input
              type="date"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all shadow-2xs font-medium px-3"
            />
          </div>
        </div>

        {/* Second row of date presets & stats & reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold mr-1">Date Presets:</span>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, startDate: todayStr, endDate: todayStr }))}
              className={cn(
                "h-8 text-xs px-3 rounded-xl border transition-all cursor-pointer font-medium flex items-center gap-1.5",
                filters.startDate === todayStr && filters.endDate === todayStr
                  ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs font-semibold"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <Calendar className="h-3 w-3" />
              Today
            </button>
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, startDate: yesterdayStr, endDate: yesterdayStr }))}
              className={cn(
                "h-8 text-xs px-3 rounded-xl border transition-all cursor-pointer font-medium flex items-center gap-1.5",
                filters.startDate === yesterdayStr && filters.endDate === yesterdayStr
                  ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs font-semibold"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  startDate: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                  endDate: todayStr,
                }))
              }
              className={cn(
                "h-8 text-xs px-3 rounded-xl border transition-all cursor-pointer font-medium flex items-center gap-1.5",
                filters.startDate === format(subDays(new Date(), 7), "yyyy-MM-dd") && filters.endDate === todayStr
                  ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs font-semibold"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
                  endDate: todayStr,
                }))
              }
              className={cn(
                "h-8 text-xs px-3 rounded-xl border transition-all cursor-pointer font-medium flex items-center gap-1.5",
                filters.startDate === format(startOfMonth(new Date()), "yyyy-MM-dd") && filters.endDate === todayStr
                  ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs font-semibold"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              This Month
            </button>
            {(filters.startDate || filters.endDate) && (
              <>
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, startDate: "", endDate: "" }))}
                  className="h-8 text-xs px-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  Clear Dates
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("range")}
                  disabled={exporting}
                  className="h-8 text-xs px-3 rounded-xl bg-purple-50 border border-purple-200 text-[#7C3AED] hover:bg-purple-100 hover:text-[#6D28D9] transition-all cursor-pointer font-semibold flex items-center gap-1.5 shadow-2xs"
                  title="Export Excel for this selected date range"
                >
                  {exporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Export This Range ({reports.length})
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-3 py-1 rounded-full shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {reports.length} report{reports.length !== 1 ? "s" : ""} loaded
            </span>
            {isAnyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl px-2.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {isAnyFilterActive && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium mr-1">Active:</span>
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                Search: "{filters.search}"
                <X
                  className="h-3 w-3 cursor-pointer hover:text-rose-500"
                  onClick={() => setFilters((f) => ({ ...f, search: "" }))}
                />
              </span>
            )}
            {filters.status && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#7C3AED] font-semibold border border-[#E9D4FF]">
                Status: {filters.status}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-rose-500"
                  onClick={() => setFilters((f) => ({ ...f, status: "" }))}
                />
              </span>
            )}
            {selectedMenteeName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#7C3AED] font-semibold border border-[#E9D4FF]">
                Mentee: {selectedMenteeName}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-rose-500"
                  onClick={() => setFilters((f) => ({ ...f, menteeUid: "" }))}
                />
              </span>
            )}
            {filters.startDate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                Date: {filters.startDate}
                <X
                  className="h-3 w-3 cursor-pointer hover:text-rose-500"
                  onClick={() => setFilters((f) => ({ ...f, startDate: "", endDate: "" }))}
                />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Modern Data Presentation: Responsive Cards for Mobile/Tablet, Table for Desktop */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Mobile & Tablet: Modern Responsive Card Grid Layout */}
        <div className="lg:hidden p-3.5 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-16 text-center">
              <div className="max-w-sm mx-auto space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-purple-50 text-[#7C3AED] mx-auto flex items-center justify-center">
                  <Search className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">No Reports Matching Criteria</h4>
                <p className="text-xs text-slate-500">Try modifying your filters or clearing search keywords.</p>
                <Button variant="outline" size="sm" onClick={handleResetFilters} className="rounded-xl border-purple-200 text-[#7C3AED] hover:bg-purple-50">
                  Reset All Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {reports.map((report) => (
                <div
                  key={report.reportId}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 space-y-3 shadow-xs hover:border-[#7C3AED]/40 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
                  onClick={() => setPreviewReport(report)}
                >
                  <div className="space-y-3">
                    {/* Top Mentee Header & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs ${getMenteeAvatarColor(report.menteeName)}`}>
                          {report.menteeName ? report.menteeName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "M"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{report.menteeName}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{report.reportDate}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {renderStatusBadge(report.status)}
                      </div>
                    </div>

                    {/* Task Title */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Task</p>
                      <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">{report.currentTask}</p>
                    </div>

                    {/* Short Description */}
                    {report.shortDescription && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</p>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{report.shortDescription}</p>
                      </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="pt-1 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target</span>
                        <span className="font-semibold text-slate-700 truncate block">{report.expectedCompletion || "—"}</span>
                      </div>
                    </div>

                    {/* Blocker alert if present */}
                    {report.blockerDependency && report.blockerDependency.trim().length > 0 && report.blockerDependency.toLowerCase() !== "none" && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>Blocker / Dependency</span>
                        </div>
                        <p className="text-xs text-rose-800 line-clamp-2">{report.blockerDependency}</p>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-semibold text-slate-400">Click to preview</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-slate-600 hover:text-[#7C3AED] hover:bg-purple-50 rounded-lg"
                        onClick={() => setPreviewReport(report)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        onClick={() => navigate(`/reports/${report.reportId}?edit=true`)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <Table className="min-w-[1450px]">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-[#F8F7FD] hover:bg-[#F8F7FD] border-b border-purple-100"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-slate-600 text-[11px] font-bold uppercase tracking-wider py-3.5 px-3.5 whitespace-nowrap"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none hover:text-[#7C3AED] transition-colors"
                              : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() &&
                            (header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 text-slate-400 shrink-0" />
                            ))}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j} className="py-3 px-2.5">
                        <Skeleton className="h-4 w-full rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-purple-50 text-[#7C3AED] mx-auto flex items-center justify-center">
                        <Search className="h-6 w-6" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">
                        No Reports Matching Criteria
                      </h4>
                      <p className="text-xs text-slate-500">
                        Try modifying your date window, status selection, or clearing search keywords.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="rounded-xl border-purple-200 text-[#7C3AED] hover:bg-purple-50"
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(weekGroups).map(([weekHeading, weekReports]) => {
                  const showWeekHeading = !filters.startDate || filters.startDate !== filters.endDate;
                  return (
                    <Fragment key={weekHeading}>
                      {showWeekHeading && (
                        <TableRow className="bg-[#FAF8FE] hover:bg-[#FAF8FE] border-y border-purple-100/80">
                          <TableCell
                            colSpan={columns.length}
                            className="py-2.5 px-4 text-xs font-bold text-[#6D28D9]"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-[#7C3AED]" />
                                <span>{weekHeading}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-[#7C3AED] bg-white border border-[#E9D4FF] px-2.5 py-0.5 rounded-full shadow-xs">
                                {weekReports.length} {weekReports.length === 1 ? "report" : "reports"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {weekReports.map((report, rowIndex) => (
                        <TableRow
                          key={report.reportId}
                          className={`cursor-pointer transition-colors hover:bg-purple-50/40 ${
                            rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          }`}
                          onClick={() => setPreviewReport(report)}
                        >
                          <TableCell className="py-3 px-3.5 whitespace-nowrap">
                            <span className="text-xs font-semibold text-slate-700">
                              {report.reportDate}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 shadow-xs ${getMenteeAvatarColor(
                                  report.menteeName
                                )}`}
                              >
                                {report.menteeName
                                  ? report.menteeName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()
                                  : "M"}
                              </div>
                              <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                                {report.menteeName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-3.5">
                            <span
                              className="text-xs font-semibold text-slate-900 block max-w-[200px] truncate"
                              title={report.currentTask}
                            >
                              {report.currentTask}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-3.5">
                            <span
                              className="text-xs text-slate-600 block max-w-[220px] truncate"
                              title={report.shortDescription}
                            >
                              {report.shortDescription || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-3.5 whitespace-nowrap">
                            {renderStatusBadge(report.status)}
                          </TableCell>
                          <TableCell className="py-3 px-3.5">
                            <div className="flex items-center gap-1.5">
                              {report.blockerDependency &&
                                report.blockerDependency.trim().length > 0 &&
                                report.blockerDependency.toLowerCase() !== "none" && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                )}
                              <span
                                className={`text-xs block max-w-[180px] truncate ${
                                  report.blockerDependency &&
                                  report.blockerDependency.trim().length > 0 &&
                                  report.blockerDependency.toLowerCase() !== "none"
                                    ? "font-medium text-rose-700"
                                    : "text-slate-400"
                                }`}
                                title={report.blockerDependency}
                              >
                                {report.blockerDependency && report.blockerDependency.trim().length > 0
                                  ? report.blockerDependency
                                  : "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-3.5 whitespace-nowrap">
                            <span className="text-xs text-slate-600">
                              {report.expectedCompletion || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-3.5">
                            <span
                              className={`text-xs block max-w-[170px] truncate ${
                                report.idleReasonWorkNeeded && report.idleReasonWorkNeeded.trim().length > 0
                                  ? "font-medium text-amber-700"
                                  : "text-slate-400"
                              }`}
                              title={report.idleReasonWorkNeeded}
                            >
                              {report.idleReasonWorkNeeded && report.idleReasonWorkNeeded.trim().length > 0
                                ? report.idleReasonWorkNeeded
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-3.5">
                            <span
                              className={`text-xs block max-w-[170px] truncate ${
                                report.notes && report.notes.trim().length > 0
                                  ? "text-slate-700"
                                  : "text-slate-400"
                              }`}
                              title={report.notes}
                            >
                              {report.notes && report.notes.trim().length > 0
                                ? report.notes
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 px-2.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-[#7C3AED] hover:bg-purple-50"
                                onClick={() => setPreviewReport(report)}
                                title="Quick View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => navigate(`/reports/${report.reportId}?edit=true`)}
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        {reports.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-t border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val: string | null) => {
                  if (val) setPageSize(Number(val));
                }}
              >
                <SelectTrigger className="h-8 w-20 text-xs rounded-lg border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-8 text-xs rounded-lg border-slate-200"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-8 text-xs rounded-lg border-slate-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quick View Modal Dialog */}
      <Dialog open={!!previewReport} onOpenChange={(open: boolean) => !open && setPreviewReport(null)}>
        {previewReport && (
          <DialogContent className="max-w-4xl w-[94vw] max-h-[calc(100dvh-2.5rem)] sm:max-h-[min(88vh,720px)] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl bg-white focus:outline-none">
            <DialogHeader className="shrink-0 px-5 py-4 sm:px-6 sm:py-4.5 bg-white border-b border-slate-200/80 relative text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pr-10">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-sm sm:text-base shadow-sm shrink-0 ring-2 ring-white shadow-purple-500/10 ${getMenteeAvatarColor(
                      previewReport.menteeName
                    )}`}
                  >
                    {previewReport.menteeName
                      ? previewReport.menteeName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : "M"}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 truncate">
                      {previewReport.menteeName}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      {previewReport.menteeEmail && (
                        <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                          <Mail className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />
                          <span className="truncate max-w-[200px]">{previewReport.menteeEmail}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />
                        Report Date: <strong className="text-slate-800 font-semibold">{previewReport.reportDate}</strong>
                      </span>
                    </DialogDescription>
                  </div>
                </div>
                <div className="shrink-0">
                  {renderStatusBadge(previewReport.status)}
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
                {/* Primary Column (Left 7 cols) */}
                <div className="md:col-span-7 space-y-4">
                  {/* Current Task */}
                  <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/70 via-white to-purple-50/20 p-4 sm:p-4.5 space-y-1 shadow-2xs">
                    <span className="text-[11px] font-bold text-[#7C3AED] uppercase tracking-wider block">
                      Current Task / Project
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {previewReport.currentTask}
                    </h3>
                  </div>

                  {/* Detailed Work Description */}
                  <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 space-y-1.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Detailed Work Description
                    </span>
                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-800 font-normal leading-relaxed whitespace-pre-wrap max-h-44 sm:max-h-56 overflow-y-auto">
                      {previewReport.shortDescription || "No detailed description provided."}
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {previewReport.notes && (
                    <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 space-y-1.5 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Additional Notes
                      </span>
                      <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                        {previewReport.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Secondary Column (Right 5 cols) */}
                <div className="md:col-span-5 space-y-4">
                  {/* Blocker & Dependency */}
                  <div
                    className={cn(
                      "rounded-xl sm:rounded-2xl p-4 border space-y-1.5 transition-all shadow-2xs",
                      previewReport.blockerDependency
                        ? "bg-rose-50/70 border-rose-200 text-rose-900"
                        : "bg-emerald-50/40 border-emerald-200/70 text-emerald-900"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {previewReport.blockerDependency ? (
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-wider",
                          previewReport.blockerDependency ? "text-rose-700" : "text-emerald-700"
                        )}
                      >
                        Blockers / Dependencies
                      </span>
                    </div>
                    {previewReport.blockerDependency ? (
                      <p className="text-xs text-rose-800 bg-white/80 p-2.5 rounded-xl border border-rose-200/80 leading-relaxed font-medium whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {previewReport.blockerDependency}
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-700 font-medium">
                        No active blockers or dependencies reported.
                      </p>
                    )}
                  </div>

                  {/* Idle Reason / Support Needed */}
                  {previewReport.idleReasonWorkNeeded && (
                    <div className="rounded-xl sm:rounded-2xl bg-amber-50/70 border border-amber-200/90 p-4 space-y-1.5 shadow-2xs text-amber-900">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                        Idle Reason / Support Needed
                      </span>
                      <p className="text-xs text-amber-900 bg-white/80 p-2.5 rounded-xl border border-amber-200/70 leading-relaxed whitespace-pre-wrap font-medium max-h-32 overflow-y-auto">
                        {previewReport.idleReasonWorkNeeded}
                      </p>
                    </div>
                  )}

                  {/* Lead & Timeline Card Grid */}
                  <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 space-y-2.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Assignment & Timeline
                    </span>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          Target Completion
                        </span>
                        <strong className="text-slate-900 font-bold">
                          {previewReport.expectedCompletion || "No date set"}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          Report ID
                        </span>
                        <span className="text-slate-600 font-mono text-[11px] truncate max-w-[140px]" title={previewReport.reportId}>
                          {previewReport.reportId}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-5 py-3 sm:px-6 sm:py-3.5 bg-slate-50/95 border-t border-slate-200 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewReport(null)}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 h-8.5 sm:h-9 px-4 font-medium cursor-pointer"
              >
                Close Preview
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white font-semibold rounded-xl h-8.5 sm:h-9 px-5 shadow-xs flex items-center gap-1.5 cursor-pointer"
                onClick={() => {
                  const id = previewReport.reportId;
                  setPreviewReport(null);
                  navigate(`/reports/${id}?edit=true`);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Full Report
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
