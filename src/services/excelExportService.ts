import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format, parseISO, startOfWeek, endOfWeek, getMonth } from "date-fns";
import type { MenteeReport, ReportFilters } from "@/types";

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

const COLUMNS = [
  { header: "Date", width: 14 },
  { header: "Name", width: 25 },
  { header: "Current Task / Project", width: 35 },
  { header: "Status", width: 16 },
  { header: "Short description", width: 35 },
  { header: "Blocker / Dependency", width: 28 },
  { header: "Idle Reason / Work Needed", width: 30 },
  { header: "Expected Completion", width: 22 },
];

const COL_COUNT = COLUMNS.length;

const TITLE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2D5016" },
};

const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FFFFFFFF" },
  name: "Calibri",
};

const WEEK_HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 12,
  color: { argb: "FF000000" },
  name: "Calibri",
};

const COL_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFC07030" },
};

const COL_HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  italic: true,
  size: 10,
  color: { argb: "FFFFFFFF" },
  name: "Calibri",
};

const DATA_FONT: Partial<ExcelJS.Font> = {
  size: 10,
  color: { argb: "FF000000" },
  name: "Calibri",
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD0D0D0" } },
  left: { style: "thin", color: { argb: "FFD0D0D0" } },
  bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
  right: { style: "thin", color: { argb: "FFD0D0D0" } },
};

function getWeekLabel(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[getMonth(date)];
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstMonday = startOfWeek(monthStart, { weekStartsOn: 1 });
    const adjustedFirst = firstMonday < monthStart
      ? new Date(firstMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
      : firstMonday;
    let weekNum = Math.floor((weekStart.getTime() - adjustedFirst.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    if (weekNum < 1) weekNum = 1;
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const endFormatted = format(weekEnd, "MM/dd/yyyy");
    return `${monthName} Week ${weekNum} - ${endFormatted}`;
  } catch {
    return dateStr;
  }
}

function groupReportsByWeekAndDate(reports: MenteeReport[]): Map<string, Map<string, MenteeReport[]>> {
  const sorted = [...reports].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const weekGroups = new Map<string, Map<string, MenteeReport[]>>();

  for (const report of sorted) {
    const weekKey = getWeekLabel(report.reportDate);
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, new Map());
    }
    const dateMap = weekGroups.get(weekKey)!;
    const dateKey = report.reportDate;
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)!.push(report);
  }

  return weekGroups;
}

function formatDateForExcel(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, "MM/dd/yyyy");
  } catch {
    return dateStr;
  }
}

function addTitleRow(ws: ExcelJS.Worksheet, rowNum: number): number {
  const row = ws.getRow(rowNum);
  row.getCell(1).value = "DAILY TEAM STATUS TRACKER";
  row.getCell(1).font = TITLE_FONT;
  row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  row.getCell(1).fill = TITLE_FILL;
  row.height = 30;

  for (let c = 1; c <= COL_COUNT; c++) {
    row.getCell(c).fill = TITLE_FILL;
  }

  ws.mergeCells(rowNum, 1, rowNum, COL_COUNT);
  return rowNum + 1;
}

function addWeekHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, label: string): number {
  const row = ws.getRow(rowNum);
  row.getCell(1).value = label;
  row.getCell(1).font = WEEK_HEADER_FONT;
  row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  row.height = 24;

  ws.mergeCells(rowNum, 1, rowNum, COL_COUNT);
  return rowNum + 1;
}

function addColumnHeaderRow(ws: ExcelJS.Worksheet, rowNum: number): number {
  const row = ws.getRow(rowNum);
  row.height = 22;

  for (let c = 0; c < COL_COUNT; c++) {
    const cell = row.getCell(c + 1);
    cell.value = COLUMNS[c].header;
    cell.font = COL_HEADER_FONT;
    cell.fill = COL_HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF8B4513" } },
      left: { style: "thin", color: { argb: "FF8B4513" } },
      bottom: { style: "thin", color: { argb: "FF8B4513" } },
      right: { style: "thin", color: { argb: "FF8B4513" } },
    };
  }

  return rowNum + 1;
}

function addDataRow(ws: ExcelJS.Worksheet, rowNum: number, report: MenteeReport): number {
  const row = ws.getRow(rowNum);
  row.height = 18;

  const values = [
    formatDateForExcel(report.reportDate),
    report.menteeName || "",
    report.currentTask || "",
    report.status || "",
    report.shortDescription || "",
    report.blockerDependency || "",
    report.idleReasonWorkNeeded || "",
    report.expectedCompletion || "",
  ];

  for (let c = 0; c < COL_COUNT; c++) {
    const cell = row.getCell(c + 1);
    cell.value = values[c];
    cell.font = DATA_FONT;
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = THIN_BORDER;
  }

  return rowNum + 1;
}

export function exportToExcel(reports: MenteeReport[], filename: string): void {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mentee Admin Portal";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Daily Status Tracker", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  for (let c = 0; c < COL_COUNT; c++) {
    ws.getColumn(c + 1).width = COLUMNS[c].width;
  }

  let currentRow = 1;

  currentRow = addTitleRow(ws, currentRow);

  const weekGroups = groupReportsByWeekAndDate(reports);

  for (const [weekLabel, dateMap] of weekGroups) {
    currentRow = addWeekHeaderRow(ws, currentRow, weekLabel);
    currentRow = addColumnHeaderRow(ws, currentRow);

    for (const [, dateReports] of dateMap) {
      const sortedByName = [...dateReports].sort((a, b) =>
        (a.menteeName || "").localeCompare(b.menteeName || "")
      );
      for (const report of sortedByName) {
        currentRow = addDataRow(ws, currentRow, report);
      }
    }

    currentRow++;
  }

  workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, filename);
  });
}
