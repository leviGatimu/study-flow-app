'use server';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { askAIBuddy } from './ai-actions';
import { revalidatePath } from 'next/cache';
import mammoth from 'mammoth';
import { parseJsonLoose, sanitizeGrades, asString, asNumber } from '@/lib/ai-parse';
import {
  getViewScope,
  byTerm,
  requireTermStamp,
  requireClassStamp,
  assertWritableScope,
  isViewingArchive,
  ARCHIVE_WRITE_ERROR,
} from '@/lib/scope';

export async function uploadReportCard(formData: FormData) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const term = formData.get('term') as string;
  const file = formData.get('file') as File;

  if (!term || !file) {
    return { error: "Term and File are required." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type;

  let prompt = `You are an expert academic advisor. I am providing a student's report card for "${term}". 
Please analyze it and extract the overall average/GPA and the individual subject grades. For each subject, provide a short, actionable piece of feedback (aiFeedback) on how to improve or maintain that grade, and assign a status ("Excellent", "Good", "Needs Work", "Critical"). Also provide a brief overall summary for the term.

The JSON must follow this exact structure:
{
  "overallAverage": 85.5,
  "aiSummary": "A solid performance this term, showing strong results in sciences but needing more focus on humanities.",
  "grades": [
    { 
      "subject": "Physics", 
      "grade": "A", 
      "status": "Excellent",
      "aiFeedback": "Outstanding work. To maintain this, keep practicing advanced problem-solving." 
    }
  ]
}
Return ONLY the JSON object. Do not include markdown code blocks.`;

  let inlineData;

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    try {
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      const textContent = result.value;
      
      prompt += `\n\nHere is the content of the document:\n\n${textContent}`;
    } catch (e) {
      console.error("Failed to parse DOCX", e);
      return { error: "Failed to read the Word document." };
    }
  } else {
    // For PDFs and images
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    inlineData = { data: base64Data, mimeType };
  }

  try {
    const result = await askAIBuddy(prompt, [], undefined, inlineData);
    
    if (result.error) return { error: result.error };

    const data = parseJsonLoose(result.text);
    if (!data) {
      // The model answered with prose, or truncated JSON. Fail loudly rather
      // than half-writing a report card.
      return { error: 'Could not read that report card. Try a clearer scan or enter the grades manually.' };
    }

    // Model output is untrusted input. These rows become a permanent academic
    // record, so anything malformed is dropped here rather than written and
    // discovered months later.
    const { grades, dropped } = sanitizeGrades(data.grades);
    if (grades.length === 0) {
      return { error: 'No readable grades were found in that document.' };
    }

    // Create Report Card
    const reportCard = await prisma.reportCard.create({
      data: {
        userId,
        term,
        overallAverage: asNumber(data.overallAverage, 0, 100),
        aiSummary: asString(data.aiSummary, 8000) ?? '',
        fileUrl: file.name,
        ...(await requireTermStamp(userId)),
      }
    });

    const gradeStamp = await requireClassStamp(userId);
    await prisma.subjectGrade.createMany({
      data: grades.map((g) => ({ reportCardId: reportCard.id, ...gradeStamp, ...g })),
    });

    revalidatePath('/marks');
    // `dropped` is surfaced rather than swallowed: a subject that silently
    // failed to parse would otherwise just be missing from the report card.
    return { success: true, reportCardId: reportCard.id, saved: grades.length, dropped };
  } catch (error: any) {
    console.error("Report Card Analysis Error:", error);
    return { error: "Failed to analyze report card. Please check your AI key and file format." };
  }
}

export async function getReportCards() {
  const userId = await getUserId();
  if (!userId) return [];

  // Marks belong to the year they were earned in. This filtered on userId
  // alone, so Year 2 opened showing Year 1's whole academic record.
  return prisma.reportCard.findMany({
    where: { userId, ...byTerm(await getViewScope(userId)) },
    include: { grades: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function deleteReportCard(id: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  // A finished year is a record, not a workspace. This action reports failure
  // by returning it, so the refusal is returned rather than thrown.
  if (await isViewingArchive(userId)) return { error: ARCHIVE_WRITE_ERROR };

  try {
    await softDelete(prisma, 'reportCard', { id, userId });
    revalidatePath('/marks');
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete report card." };
  }
}

export async function createManualReportCard(term: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  // "Term 1" exists in every academic year, so the duplicate check has to be
  // per year - otherwise Year 2 can never have a Term 1 report card.
  const stamp = await requireTermStamp(userId);
  const existing = await prisma.reportCard.findFirst({
    where: { userId, term, ...byTerm(await getViewScope(userId)) }
  });
  if (existing) {
    return { error: "A report card for this term already exists." };
  }

  const reportCard = await prisma.reportCard.create({
    data: {
      userId,
      term,
      overallAverage: 0,
      aiSummary: "Manual Entry Report Card. Add subject grades below.",
      fileUrl: "Manual Entry",
      ...stamp,
    }
  });

  revalidatePath('/marks');
  return { success: true, reportCardId: reportCard.id };
}

export async function addSubjectGrade(reportCardId: string, data: { subject: string; grade: string; status: string; aiFeedback: string }) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  // SubjectGrade.classId is denormalised from the card's term, so it is taken
  // FROM THE CARD rather than re-resolved: a grade must never end up filed
  // under a different year from the report card it is printed on.
  const card = await prisma.reportCard.findFirst({
    where: { id: reportCardId, userId },
    select: { id: true, termRef: { select: { classId: true } } },
  });
  if (!card) throw new Error('Report card not found');

  // A finished year is a record, not a workspace. The UI hides these
  // controls inside an archive; this is the guarantee behind that, because
  // hidden is not the same as prevented.
  await assertWritableScope(userId);

  const grade = await prisma.subjectGrade.create({
    data: {
      reportCardId,
      classId: card.termRef?.classId ?? null,
      subject: data.subject,
      grade: data.grade,
      status: data.status,
      aiFeedback: data.aiFeedback
    }
  });

  // Re-calculate report card overallAverage
  const allGrades = await prisma.subjectGrade.findMany({
    where: { reportCardId }
  });

  const parsedGrades = allGrades.map(g => {
    const num = parseFloat(g.grade.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  });
  const avg = parsedGrades.length > 0 ? parseFloat((parsedGrades.reduce((a, b) => a + b, 0) / parsedGrades.length).toFixed(1)) : 0;

  await prisma.reportCard.update({
    where: { id: reportCardId },
    data: { overallAverage: avg }
  });

  revalidatePath('/marks');
  return { success: true, grade };
}

export async function updateSubjectGrade(id: string, data: { subject: string; grade: string; status: string; aiFeedback: string }) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  // Ownership check. This used to update by id alone, so any signed-in user
  // could rewrite another user's grade by guessing one.
  const owned = await prisma.subjectGrade.findFirst({
    where: { id, reportCard: { userId } },
    select: { id: true },
  });
  if (!owned) throw new Error('Grade not found');

  await assertWritableScope(userId);

  const updated = await prisma.subjectGrade.update({
    where: { id },
    data: {
      subject: data.subject,
      grade: data.grade,
      status: data.status,
      aiFeedback: data.aiFeedback
    }
  });

  // Re-calculate report card overallAverage
  const reportCardId = updated.reportCardId;
  const allGrades = await prisma.subjectGrade.findMany({
    where: { reportCardId }
  });

  const parsedGrades = allGrades.map(g => {
    const num = parseFloat(g.grade.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  });
  const avg = parsedGrades.length > 0 ? parseFloat((parsedGrades.reduce((a, b) => a + b, 0) / parsedGrades.length).toFixed(1)) : 0;

  await prisma.reportCard.update({
    where: { id: reportCardId },
    data: { overallAverage: avg }
  });

  revalidatePath('/marks');
  return { success: true };
}

export async function deleteSubjectGrade(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  // Same ownership check as updateSubjectGrade, for the same reason.
  // reportCardId is read up front now: a soft delete reports how many rows it
  // tombstoned, not which row it was, and the average below has to be
  // recomputed for the card this grade belonged to.
  const owned = await prisma.subjectGrade.findFirst({
    where: { id, reportCard: { userId } },
    select: { id: true, reportCardId: true },
  });
  if (!owned) throw new Error('Grade not found');

  await assertWritableScope(userId);

  await softDelete(prisma, 'subjectGrade', { id });

  const reportCardId = owned.reportCardId;
  const allGrades = await prisma.subjectGrade.findMany({
    where: { reportCardId }
  });

  const parsedGrades = allGrades.map(g => {
    const num = parseFloat(g.grade.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  });
  const avg = parsedGrades.length > 0 ? parseFloat((parsedGrades.reduce((a, b) => a + b, 0) / parsedGrades.length).toFixed(1)) : 0;

  await prisma.reportCard.update({
    where: { id: reportCardId },
    data: { overallAverage: avg }
  });

  revalidatePath('/marks');
  return { success: true };
}
