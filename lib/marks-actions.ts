'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { askAIBuddy } from './ai-actions';
import { revalidatePath } from 'next/cache';
import mammoth from 'mammoth';

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

    // Parse JSON safely
    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```')) {
      const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleanJson = match[1];
      } else {
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
      }
    }
    const data = JSON.parse(cleanJson);

    // Create Report Card
    const reportCard = await prisma.reportCard.create({
      data: {
        userId,
        term,
        overallAverage: data.overallAverage || null,
        aiSummary: data.aiSummary || "",
        fileUrl: file.name,
      }
    });

    // Create Subject Grades
    if (data.grades && Array.isArray(data.grades)) {
      await prisma.subjectGrade.createMany({
        data: data.grades.map((g: any) => ({
          reportCardId: reportCard.id,
          subject: g.subject,
          grade: g.grade,
          status: g.status,
          aiFeedback: g.aiFeedback
        }))
      });
    }

    revalidatePath('/marks');
    return { success: true, reportCardId: reportCard.id };
  } catch (error: any) {
    console.error("Report Card Analysis Error:", error);
    return { error: "Failed to analyze report card. Please check your AI key and file format." };
  }
}

export async function getReportCards() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.reportCard.findMany({
    where: { userId },
    include: { grades: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function deleteReportCard(id: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  try {
    await prisma.reportCard.deleteMany({
      where: { id, userId }
    });
    revalidatePath('/marks');
    return { success: true };
  } catch (error) {
    return { error: "Failed to delete report card." };
  }
}

export async function createManualReportCard(term: string) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const existing = await prisma.reportCard.findFirst({
    where: { userId, term }
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
      fileUrl: "Manual Entry"
    }
  });

  revalidatePath('/marks');
  return { success: true, reportCardId: reportCard.id };
}

export async function addSubjectGrade(reportCardId: string, data: { subject: string; grade: string; status: string; aiFeedback: string }) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const grade = await prisma.subjectGrade.create({
    data: {
      reportCardId,
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

  const deleted = await prisma.subjectGrade.delete({
    where: { id }
  });

  const reportCardId = deleted.reportCardId;
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
