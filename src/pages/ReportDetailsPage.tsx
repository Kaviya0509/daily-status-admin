import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { getReportById, updateReport } from "@/services/reportService";
import type { MenteeReport, ReportStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Loader2,
  Calendar,
  AlertTriangle,
  Clock,
  User,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  FileText,
  Briefcase,
} from "lucide-react";

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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          Completed
        </span>
      );
    case "In Progress":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
          In Progress
        </span>
      );
    case "Blocked":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs animate-pulse">
          <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
          Blocked
        </span>
      );
    case "On Hold":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
          On Hold
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
          {status}
        </span>
      );
  }
}

function formatTimestamp(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts || !ts.toDate) return "-";
  try {
    return format(ts.toDate(), "MMMM d, yyyy 'at' h:mm a");
  } catch {
    return "-";
  }
}

const editSchema = z.object({
  currentTask: z.string().min(1, "Current task is required"),
  status: z.enum(["Not Started", "In Progress", "Blocked", "Completed", "On Hold"]),
  shortDescription: z.string().min(1, "Description is required"),
  managerLead: z.string(),
  blockerDependency: z.string(),
  idleReasonWorkNeeded: z.string(),
  expectedCompletion: z.string().nullable(),
  notes: z.string(),
});

type EditFormData = z.infer<typeof editSchema>;

export default function ReportDetailsPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [report, setReport] = useState<MenteeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(searchParams.get("edit") === "true");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });

  const currentStatus = watch("status");

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;
      try {
        setLoading(true);
        const data = await getReportById(reportId);
        if (data) {
          setReport(data);
          reset({
            currentTask: data.currentTask,
            status: data.status,
            shortDescription: data.shortDescription,
            managerLead: data.managerLead || "",
            blockerDependency: data.blockerDependency || "",
            idleReasonWorkNeeded: data.idleReasonWorkNeeded || "",
            expectedCompletion: data.expectedCompletion || "",
            notes: data.notes || "",
          });
        } else {
          setError("Report not found.");
        }
      } catch (err) {
        console.error("Error fetching report:", err);
        setError("Failed to load report from database.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId, reset]);

  const onSubmit = async (data: EditFormData) => {
    if (!reportId) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await updateReport(reportId, data);
      const updated = await getReportById(reportId);
      if (updated) {
        setReport(updated);
      }
      setEditing(false);
      setSuccessMsg("Report updated successfully.");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      console.error("Error updating report:", err);
      setError("Failed to update report.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (report) {
      reset({
        currentTask: report.currentTask,
        status: report.status,
        shortDescription: report.shortDescription,
        managerLead: report.managerLead || "",
        blockerDependency: report.blockerDependency || "",
        idleReasonWorkNeeded: report.idleReasonWorkNeeded || "",
        expectedCompletion: report.expectedCompletion || "",
        notes: report.notes || "",
      });
    }
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="h-16 w-16 bg-slate-100 text-slate-400 rounded-2xl mx-auto flex items-center justify-center">
          <FileText className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Report Not Found</h3>
        <p className="text-sm text-slate-500">
          The requested record could not be found or may have been deleted.
        </p>
        <Button onClick={() => navigate("/tracker")} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to Tracker
        </Button>
      </div>
    );
  }

  const initials = report.menteeName
    ? report.menteeName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "M";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link to="/tracker" className="hover:text-orange-600 transition-colors">
          Daily Tracker
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-800">Report Details</span>
        <span className="text-slate-400">•</span>
        <span className="font-mono text-slate-400">{report.reportDate}</span>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm">
          <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Executive Header Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-md ${getMenteeAvatarColor(
                report.menteeName
              )}`}
            >
              {initials}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {report.menteeName}
                </h2>
                {!editing && renderStatusBadge(report.status)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-[#7C3AED]" />
                  {report.reportDate}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Lead: {report.managerLead || "Unassigned"}
                </span>
                <span>•</span>
                <span className="font-mono text-[11px] text-slate-400">
                  ID: {report.reportId}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/tracker")}
              className="rounded-xl border-slate-200 hover:bg-slate-100 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Tracker
            </Button>

            {!editing ? (
              <Button
                size="sm"
                onClick={() => setEditing(true)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold rounded-xl text-xs shadow-xs"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit Report
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="rounded-xl border-slate-200 text-xs"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit(onSubmit)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Form / Cards */}
      <div className="space-y-5">
        {/* Card 1: Task Overview */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Briefcase className="h-4 w-4 text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-slate-900">Task Overview & Execution</h3>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Status</Label>
                  <Select
                    value={currentStatus || report.status}
                    onValueChange={(val: string | null) => {
                      if (val) setValue("status", val as ReportStatus);
                    }}
                  >
                    <SelectTrigger className="mt-1 h-9 rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Reporting Manager / Lead
                  </Label>
                  <Input
                    className="mt-1 h-9 rounded-xl border-slate-200 text-xs"
                    {...register("managerLead")}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Current Task / Project Title
                </Label>
                <Input
                  className="mt-1 h-9 rounded-xl border-slate-200 text-xs font-medium"
                  {...register("currentTask")}
                />
                {errors.currentTask && (
                  <p className="text-xs text-rose-500 mt-1">{errors.currentTask.message}</p>
                )}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Detailed Work Description
                </Label>
                <Textarea
                  className="mt-1 rounded-xl border-slate-200 text-xs"
                  rows={4}
                  {...register("shortDescription")}
                />
                {errors.shortDescription && (
                  <p className="text-xs text-rose-500 mt-1">{errors.shortDescription.message}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Task / Project
                </span>
                <p className="text-base font-bold text-slate-900 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                  {report.currentTask}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Work Description
                </span>
                <p className="text-xs text-slate-700 bg-slate-50/80 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                  {report.shortDescription}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Blockers & Dependencies */}
        <div
          className={`rounded-2xl border p-6 shadow-xs space-y-4 transition-colors ${
            report.blockerDependency
              ? "bg-rose-50/20 border-rose-200"
              : "bg-white border-slate-200/90"
          }`}
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900">Blockers & Dependencies</h3>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Blocker / Dependency Details
                </Label>
                <Textarea
                  className="mt-1 rounded-xl border-slate-200 text-xs"
                  rows={3}
                  placeholder="Describe any issues holding back this task..."
                  {...register("blockerDependency")}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Idle Reason / Work Needed
                </Label>
                <Textarea
                  className="mt-1 rounded-xl border-slate-200 text-xs"
                  rows={2}
                  placeholder="Additional context if waiting for tasks..."
                  {...register("idleReasonWorkNeeded")}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {report.blockerDependency ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Reported Blocker</span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {report.blockerDependency}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No blocker reported for this date.</p>
              )}

              {report.idleReasonWorkNeeded && (
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 text-amber-900 space-y-1">
                  <span className="text-xs font-semibold text-amber-700 block">
                    Idle Reason / Support Needed:
                  </span>
                  <p className="text-xs whitespace-pre-wrap">{report.idleReasonWorkNeeded}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 3: Timeline & Notes */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Clock className="h-4 w-4 text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-slate-900">Timeline, Target & Audit</h3>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Expected Completion Date
                </Label>
                <Input
                  type="date"
                  className="mt-1 h-9 w-48 rounded-xl border-slate-200 text-xs"
                  {...register("expectedCompletion")}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Internal Notes</Label>
                <Textarea
                  className="mt-1 rounded-xl border-slate-200 text-xs"
                  rows={3}
                  {...register("notes")}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Target Completion
                  </span>
                  <p className="text-xs font-bold text-slate-800">
                    {report.expectedCompletion || "No date defined"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Initial Submission
                  </span>
                  <p className="text-xs font-medium text-slate-600">
                    {formatTimestamp(report.createdAt)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Last Modified
                  </span>
                  <p className="text-xs font-medium text-slate-600">
                    {formatTimestamp(report.updatedAt)}
                  </p>
                </div>
              </div>

              {report.notes && (
                <div className="space-y-1 pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Additional Notes
                  </span>
                  <p className="text-xs text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {report.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
