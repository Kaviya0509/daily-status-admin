import {
  collection,
  query,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  type DocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { MenteeReport, ReportFilters, DashboardStats, UserProfile } from "@/types";

const REPORTS_COLLECTION = "menteeReports";
const USERS_COLLECTION = "users";

export function normalizeReport(docId: string, data: any): MenteeReport {
  const menteeName = data.menteeName || data.name || "Mentee";
  const reportDate = data.reportDate || data.date || new Date().toISOString().split("T")[0];
  const menteeEmail = data.menteeEmail || "";
  const menteeUid = data.menteeUid || menteeEmail || docId;
  return {
    reportId: docId || data.reportId,
    menteeUid,
    menteeName,
    menteeEmail,
    reportDate,
    currentTask: data.currentTask || "",
    status: data.status || "In Progress",
    shortDescription: data.shortDescription || "",
    managerLead: data.managerLead || "",
    blockerDependency: data.blockerDependency || "",
    idleReasonWorkNeeded: data.idleReasonWorkNeeded || "",
    expectedCompletion: data.expectedCompletion || null,
    notes: data.notes || "",
    createdAt: data.createdAt || data.submittedAt || Timestamp.now(),
    updatedAt: data.updatedAt || Timestamp.now(),
  };
}

export const subscribeToReports = (
  callback: (reports: MenteeReport[]) => void,
  onError?: (err: Error) => void
) => {
  const q = query(collection(db, REPORTS_COLLECTION));
  return onSnapshot(
    q,
    (snapshot) => {
      const reports = snapshot.docs.map((docSnap) =>
        normalizeReport(docSnap.id, docSnap.data())
      );
      reports.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
      callback(reports);
    },
    (err) => {
      console.warn("Firestore reports subscription error:", err);
      if (onError) onError(err);
    }
  );
};

export const getAllReports = async (
  filters: ReportFilters,
  pageSize: number = 50,
  _lastDoc?: DocumentSnapshot
): Promise<{ reports: MenteeReport[]; lastDocument: DocumentSnapshot | null; total: number }> => {
  let firestoreReports: MenteeReport[] = [];
  try {
    const snapshot = await getDocs(collection(db, REPORTS_COLLECTION));
    firestoreReports = snapshot.docs.map((docSnap) =>
      normalizeReport(docSnap.id, docSnap.data())
    );
  } catch (err) {
    console.warn("Could not fetch reports from Firestore directly:", err);
  }

  // Client-side filtering
  let filtered = firestoreReports.filter((r) => {
    if (filters.startDate && r.reportDate < filters.startDate) return false;
    if (filters.endDate && r.reportDate > filters.endDate) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.menteeUid && r.menteeUid !== filters.menteeUid) return false;
    if (filters.search) {
      const qLower = filters.search.toLowerCase();
      const match =
        r.menteeName.toLowerCase().includes(qLower) ||
        (r.menteeEmail && r.menteeEmail.toLowerCase().includes(qLower)) ||
        r.currentTask.toLowerCase().includes(qLower) ||
        r.shortDescription.toLowerCase().includes(qLower) ||
        (r.managerLead && r.managerLead.toLowerCase().includes(qLower));
      if (!match) return false;
    }
    return true;
  });

  // Sort descending by report date
  filtered.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

  return { reports: filtered.slice(0, pageSize), lastDocument: null, total: filtered.length };
};

export const getReportById = async (reportId: string): Promise<MenteeReport | null> => {
  try {
    const docRef = doc(db, REPORTS_COLLECTION, reportId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return normalizeReport(docSnap.id, docSnap.data());
    }
  } catch (err) {
    console.warn("Could not fetch report by ID:", err);
  }
  return null;
};

export const updateReport = async (
  reportId: string,
  data: Partial<MenteeReport>
): Promise<void> => {
  const docRef = doc(db, REPORTS_COLLECTION, reportId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
};

export const deleteReport = async (reportId: string): Promise<void> => {
  const docRef = doc(db, REPORTS_COLLECTION, reportId);
  await deleteDoc(docRef);
};

export const getReportsForExport = async (
  filters: ReportFilters
): Promise<MenteeReport[]> => {
  const result = await getAllReports(filters, 500);
  return result.reports;
};

export const getDashboardStats = async (date: string): Promise<DashboardStats> => {
  const mentees = await getActiveMentees();
  const totalActiveMentees = mentees.length;

  const reportsResult = await getAllReports(
    {
      search: "",
      startDate: "",
      endDate: "",
      menteeUid: "",
      status: "",
    },
    200
  );

  const todayReports = reportsResult.reports.filter((r) => r.reportDate === date);
  const reportsSubmittedToday = todayReports.length;
  const inProgress = todayReports.filter((r) => r.status === "In Progress").length;
  const blocked = todayReports.filter((r) => r.status === "Blocked").length;
  const completed = todayReports.filter((r) => r.status === "Completed").length;

  const submittedUids = new Set(todayReports.map((r) => r.menteeUid));
  const missingToday = Math.max(0, totalActiveMentees - submittedUids.size);

  return {
    totalActiveMentees,
    reportsSubmittedToday,
    inProgress,
    blocked,
    completed,
    missingToday,
  };
};

export function formatNameFromEmail(emailOrId: string): string {
  if (!emailOrId) return "";
  const base = (emailOrId.includes("@") ? emailOrId.split("@")[0] : emailOrId).trim();
  const parts = base.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return base;
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export const getActiveMentees = async (): Promise<UserProfile[]> => {
  const menteeMap = new Map<string, UserProfile>();

  // 1. Fetch from Firestore users collection
  try {
    const snapshot = await getDocs(collection(db, USERS_COLLECTION));
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.role === "mentee") {
        const rawName = (data.displayName || data.name || "").trim();
        const email = (data.email || "").trim();
        const cleanName =
          rawName && !rawName.includes("@")
            ? rawName
            : formatNameFromEmail(email || docSnap.id);

        menteeMap.set(docSnap.id, {
          uid: docSnap.id,
          displayName: cleanName || "Mentee",
          email: email || "",
          role: "mentee",
          active: data.active !== false,
          createdAt: data.createdAt || Timestamp.now(),
        });
      }
    });
  } catch (err) {
    console.warn("Could not query users collection:", err);
  }

  // 2. Discover mentees dynamically from actual reports stored in Firestore
  try {
    const reportsSnap = await getDocs(collection(db, REPORTS_COLLECTION));
    reportsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const uid = data.menteeUid || data.menteeEmail || docSnap.id;
      const rawName = (data.menteeName || data.name || "").trim();
      const email = (data.menteeEmail || "").trim();
      const cleanName =
        rawName && !rawName.includes("@")
          ? rawName
          : formatNameFromEmail(email || uid);

      if (uid) {
        if (!menteeMap.has(uid)) {
          menteeMap.set(uid, {
            uid,
            displayName: cleanName || "Mentee",
            email,
            role: "mentee",
            active: true,
            createdAt: data.createdAt || Timestamp.now(),
          });
        } else {
          // If already in map, upgrade if existing displayName is an email or generic
          const existing = menteeMap.get(uid)!;
          if (
            cleanName &&
            (!existing.displayName ||
              existing.displayName.includes("@") ||
              existing.displayName === "Mentee")
          ) {
            existing.displayName = cleanName;
          }
          if (!existing.email && email) {
            existing.email = email;
          }
        }
      }
    });
  } catch (err) {
    console.warn("Could not query menteeReports for mentees:", err);
  }

  return Array.from(menteeMap.values());
};

export const addMentee = async (
  mentee: Omit<UserProfile, "uid" | "createdAt">
): Promise<UserProfile> => {
  const uid = `mentee_${Date.now()}`;
  const newMentee: UserProfile = {
    ...mentee,
    uid,
    createdAt: Timestamp.now(),
  };

  await setDoc(doc(db, USERS_COLLECTION, uid), newMentee);
  return newMentee;
};
