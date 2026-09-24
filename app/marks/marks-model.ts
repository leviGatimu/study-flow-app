import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { parseGradeToPercentage } from "../subjects/subject-model";

export interface SubjectGradeType {
  id: string;
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
}

export interface ReportCardType {
  id: string;
  term: string;
  overallAverage: number | null;
  aiSummary: string | null;
  fileUrl: string | null;
  createdAt: Date;
  grades: SubjectGradeType[];
}

export type GoalTarget = { subject: string; targetGrade: number };

export type GradeFormValues = {
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
};

export const EMPTY_GRADE_FORM: GradeFormValues = { subject: "", grade: "", status: "Good", aiFeedback: "" };
export const DEFAULT_FEEDBACK = "Consistently work on course materials.";
export const STATUSES = ["Excellent", "Good", "Needs Work", "Critical"] as const;

/**
 * A mark as a percentage: "85", "85%", "18/20" and letter grades all read
 * correctly (the Subjects parser). Null when the mark cannot be read.
 */
export function parseGrade(grade: string): number | null {
  return parseGradeToPercentage(grade);
}

export function letterGrade(gradeStr: string): string {
  const score = parseGrade(gradeStr);
  if (score === null) return "?";
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 75) return "C+";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function standingLabel(avg: number): string {
  if (avg >= 85) return "First class";
  if (avg >= 70) return "Excellent standing";
  if (avg >= 55) return "Good standing";
  return "Needs focus";
}

/** Status colours report the standing: good is primary, weak is orange, critical is red. */
export function statusTone(status: string): "success" | "warning" | "danger" | "primary" {
  if (status === "Excellent") return "success";
  if (status === "Needs Work") return "warning";
  if (status === "Critical") return "danger";
  return "primary";
}

export function statusBarClass(status: string): string {
  return {
    success: "bg-success",
    warning: "bg-orange-500",
    danger: "bg-destructive",
    primary: "bg-primary",
  }[statusTone(status)];
}

/** Same normalisation Goals and Insights use, so a target finds its subject. */
export function subjectKey(s: string): string {
  return s.replace(/\s*\(revision\)\s*/gi, "").replace(/'/g, "").trim().toLowerCase();
}

export function exportReportCardPdf(card: ReportCardType, term: string) {
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.text("Academic Performance Record", 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Term: ${term}`, 14, 30);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 37);

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Academic Strategy & Overview Summary", 14, 50);
  doc.setFontSize(10);
  doc.setTextColor(80);
  const summaryLines = doc.splitTextToSize(card.aiSummary || "No summary available.", 180);
  doc.text(summaryLines, 14, 57);

  autoTable(doc, {
    startY: 75,
    head: [["Subject", "Grade (%)", "Standing", "Target Study Strategy Guidelines"]],
    body: card.grades.map((g) => [g.subject, g.grade, g.status, g.aiFeedback]),
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 9, cellPadding: 5 },
  });

  doc.save(`Academic_Report_${term.replace(/\s+/g, "_")}.pdf`);
}
