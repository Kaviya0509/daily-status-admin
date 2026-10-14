import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { MenteeReport, ReportFilters } from "@/types";
import type { Timestamp } from "firebase/firestore";

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return "";
  try {
    const date = ts.toDate();
    return format(date, "yyyy-MM-dd HH:mm:ss");
  } catch {
    return "";
  }
}

export function generateExportFilename(filters: ReportFilters): string {
  const prefix = "Mentee_Daily_Status";

  if (filters.startDate && filters.endDate && filters.startDate === filters.endDate) {
    return `${prefix}_${filters.startDate}.xlsx`;
  }
  if (filters.startDate && filters.endDate) {
    return `${prefix}_${filters.startDate}_to_${filters.endDate}.xlsx`;
  }
  if (filters.startDate || filters.endDate || filters.status || filters.menteeUid || filters.search) {
    const today = format(new Date(), "yyyy-MM-dd");
    return `${prefix}_Filtered_${today}.xlsx`;
  }
  return `${prefix}_All_Reports.xlsx`;
}

export function exportToExcel(reports: MenteeReport[], filename: string): void {
  const data = reports.map((report) => ({
    "Report Date": report.reportDate,
    "Mentee Name": report.menteeName,
    "Current Task/Project": report.currentTask,
    "Status": report.status,
    "Short Description": report.shortDescription,
    "Manager/Lead": report.managerLead,
    "Blocker/Dependency": report.blockerDependency,
    "Idle Reason/Work Needed": report.idleReasonWorkNeeded,
    "Expected Completion": report.expectedCompletion || "",
    "Notes": report.notes,
    "Created At": formatTimestamp(report.createdAt),
    "Last Updated": formatTimestamp(report.updatedAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Column widths
  worksheet["!cols"] = [
    { wch: 14 },  // Report Date
    { wch: 22 },  // Mentee Name
    { wch: 30 },  // Current Task/Project
    { wch: 14 },  // Status
    { wch: 40 },  // Short Description
    { wch: 20 },  // Manager/Lead
    { wch: 30 },  // Blocker/Dependency
    { wch: 30 },  // Idle Reason/Work Needed
    { wch: 18 },  // Expected Completion
    { wch: 35 },  // Notes
    { wch: 20 },  // Created At
    { wch: 20 },  // Last Updated
  ];

  // Freeze header row
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Auto-filter on all columns
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };

  // Style header row
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F2937" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };

  const colCount = 12;
  for (let col = 0; col < colCount; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = headerStyle;
    }
  }

  // Style data cells with text wrapping
  const dataStyle = {
    alignment: { vertical: "top", wrapText: true },
  };

  for (let row = 1; row <= range.e.r; row++) {
    for (let col = 0; col < colCount; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = dataStyle;
      }
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Status Tracker");

  XLSX.writeFile(workbook, filename);
}
