import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveMentees, addMentee, getAllReports } from "@/services/reportService";
import type { UserProfile, MenteeReport } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  FileText,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ManageMenteesPage() {
  const [mentees, setMentees] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<MenteeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [menteesData, reportsData] = await Promise.all([
        getActiveMentees(),
        getAllReports({ search: "", startDate: "", endDate: "", menteeUid: "", status: "" }, 500),
      ]);
      setMentees(menteesData);
      setReports(reportsData.reports);
    } catch {
      toast.error("Failed to load mentees roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMentee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim() || !newEmail.trim()) {
      toast.error("Please fill in both name and email");
      return;
    }
    setSubmitting(true);
    try {
      const created = await addMentee({
        displayName: newDisplayName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: "mentee",
        active: true,
      });
      setMentees((prev) => [created, ...prev]);
      toast.success(`Mentee ${created.displayName} added to workspace!`);
      setNewDisplayName("");
      setNewEmail("");
      setAddModalOpen(false);
    } catch {
      toast.error("Failed to add mentee");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMentees = mentees.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const getReportCountForMentee = (uid: string) => {
    return reports.filter((r) => r.menteeUid === uid).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="h-7 w-7 text-[#7C3AED]" />
            Manage Mentees
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Directory of registered mentees, participation metrics, and profile details.
          </p>
        </div>

        <Button
          onClick={() => setAddModalOpen(true)}
          className="bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add New Mentee
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search mentees by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs rounded-xl bg-slate-50 border-slate-200 focus:border-[#7C3AED]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mentees Grid */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED] mx-auto" />
          <p className="text-xs text-slate-500 mt-3">Loading mentee directory...</p>
        </div>
      ) : filteredMentees.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Users className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <h4 className="text-base font-bold text-slate-800">No Mentees Found</h4>
          <p className="text-xs text-slate-500 mt-1">No mentees match your search filter.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMentees.map((mentee) => {
            const reportCount = getReportCountForMentee(mentee.uid);
            return (
              <Card
                key={mentee.uid}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-shadow"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A855F7] text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {(mentee.displayName[0] || "M").toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">
                          {mentee.displayName}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" />
                          {mentee.email}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Total Reports
                      </span>
                      <span className="font-extrabold text-slate-800 text-sm flex items-center gap-1 mt-0.5">
                        <FileText className="h-3.5 w-3.5 text-[#7C3AED]" />
                        {reportCount}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Role
                      </span>
                      <span className="font-semibold text-slate-700 text-xs mt-0.5 block capitalize">
                        {mentee.role}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/tracker?mentee=${mentee.uid}`)}
                    className="w-full h-8 rounded-xl text-xs text-slate-700 border-slate-200 hover:border-purple-300 hover:text-[#7C3AED] flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Reports in Tracker
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Mentee Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#7C3AED]" />
              Add Mentee to Workspace
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Register a new mentee to start tracking their daily standup submissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMentee} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Full Name</Label>
              <Input
                placeholder="e.g. John Doe"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email Address</Label>
              <Input
                type="email"
                placeholder="e.g. mentee@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save Mentee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
