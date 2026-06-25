'use server';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { askAIBuddy } from './ai-actions';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addXp } from './gamification';
import mammoth from 'mammoth';

// Canonical description of every question shape the quiz engine understands.
const QUESTION_TYPE_SPEC = `Every question object has "id", "type", and "question". Per type, also include:
- "MULTIPLE_CHOICE": "options" (exactly 4 distinct strings) + "expectedAnswer" (exact text of the one correct option).
- "MULTIPLE_SELECT": "options" (4-5 strings, TWO OR MORE correct) + "expectedAnswer" (comma-separated exact texts of ALL correct options).
- "TRUE_FALSE": "question" is a statement; "expectedAnswer" is exactly "True" or "False" (no options).
- "FILL_IN_THE_BLANK": "question" contains a "____" blank; "expectedAnswer" is the missing word/phrase.
- "SHORT_ANSWER": "expectedAnswer" is a concise 1-2 sentence model answer.
- "OPEN_ENDED": "expectedAnswer" is a full paragraph model answer.
- "MATCHING": "terms" (array) and "definitions" (SAME length but SHUFFLED so they do NOT line up) + "expectedAnswer" formatted "Term: correct definition; Term2: correct definition2".
- "ORDERING": "items" (array given SHUFFLED) + "expectedAnswer" is the correct sequence joined with " | ".`;

// Which types to draw from for each requested quiz style.
function typesForQuizType(quizType: string): string {
  switch (quizType) {
    case 'MULTIPLE_CHOICE':
      return 'Use ONLY selection-based types, varied between: MULTIPLE_CHOICE, TRUE_FALSE and MULTIPLE_SELECT.';
    case 'OPEN_ENDED':
      return 'Use ONLY written-response types, varied between: OPEN_ENDED, SHORT_ANSWER and FILL_IN_THE_BLANK.';
    case 'MATCHING':
      return 'Use ONLY association/sequencing types: MATCHING and ORDERING (favour MATCHING).';
    case 'MIX':
    default:
      return 'Use a rich, varied MIX of ALL supported types: MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, FILL_IN_THE_BLANK, SHORT_ANSWER, OPEN_ENDED, MATCHING and ORDERING. Vary them so no two consecutive questions share a type.';
  }
}

export async function createTutorModule(formData: FormData) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const subject = formData.get('subject') as string;
  const file = formData.get('file') as File;
  const questionCount = formData.get('questionCount') as string || "10";
  const customInstructions = formData.get('instructions') as string;
  const quizType = (formData.get('quizType') as string) || 'MIX';

  if (!subject || !file) {
    return { error: "Subject and File are required." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type;

  let prompt = `You are an expert academic tutor. I am providing a document about "${subject}".
Analyze it and generate exactly ${questionCount} questions that genuinely test the student's understanding.
${customInstructions ? `CRITICAL FOCUS: The user requested this focus: "${customInstructions}". Adhere strictly to it.` : ""}

${typesForQuizType(quizType)}

${QUESTION_TYPE_SPEC}

Return ONLY this JSON object (no markdown, no backticks):
{
  "title": "A catchy title for this Quiz",
  "questions": [ /* exactly ${questionCount} question objects following the spec above */ ]
}
Rules: make options/distractors plausible; for MATCHING the "definitions" array MUST be shuffled relative to "terms"; keep each question self-contained. Ensure exactly ${questionCount} questions.`;

  let inlineData;

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    try {
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      const textContent = result.value;
      
      prompt += `\n\nHere is the content of the document:\n\n${textContent}`;
    } catch (e) {
      console.error("Failed to parse DOCX", e);
      return { error: "Failed to read the Word document. Please ensure it is a valid .docx file." };
    }
  } else {
    // For PDFs and other supported types
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

    const module = await prisma.tutorModule.create({
      data: {
        userId,
        subject,
        title: data.title,
        questions: JSON.stringify(data.questions),
        notes: "[]",
        videos: "[]",
        flashcards: "[]",
        exercises: "[]",
        sourcePdfUrl: file.name
      }
    });

    revalidatePath('/tutor');
    return { success: true, moduleId: module.id };
  } catch (error: any) {
    console.error("Tutor Generation Error:", error);
    return { error: "Failed to generate tutor module. Please check your AI key and file size." };
  }
}

export async function getTutorModules() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.tutorModule.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getDueTutorModules() {
  const userId = await getUserId();
  if (!userId) return [];

  const now = new Date();

  return prisma.tutorModule.findMany({
    where: { 
      userId,
      nextReviewAt: { lte: now }
    },
    orderBy: { nextReviewAt: 'asc' },
    take: 3
  });
}

export async function getTutorModuleById(id: string) {
  const userId = await getUserId();
  if (!userId) return null;

  return prisma.tutorModule.findFirst({
    where: { id, userId },
    include: {
      attempts: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
}

export async function updateTutorModuleScore(id: string, score: number, understanding: string) {
  const userId = await getUserId();
  if (!userId) return;

  // Spaced Repetition Logic: Calculate gap based on score
  let daysGap = 1;
  if (score >= 90) daysGap = 7;
  else if (score >= 60) daysGap = 3;

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + daysGap);

  await prisma.tutorModule.updateMany({
    where: { id, userId },
    data: { 
      score, 
      understanding,
      lastReviewedAt: new Date(),
      nextReviewAt
    }
  });

  // Award massive XP for learning: Score * 10
  await addXp(userId, score * 10);
  
  revalidatePath(`/tutor/${id}`);
  revalidatePath('/tutor');
  revalidatePath('/');
  revalidatePath('/history');
}

export async function deleteTutorModule(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.tutorModule.deleteMany({
    where: { id, userId }
  });
  
  revalidatePath('/tutor');
  redirect('/tutor');
}

export async function getQuizHint(question: string, expectedAnswer: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  const prompt = `You are a helpful academic tutor. A student is struggling with the following question:
"${question}"

The expected correct answer is:
"${expectedAnswer}"

Provide a brief, encouraging hint to point the student in the right direction. 
CRITICAL RULE: Do NOT reveal the direct answer. Just give a clue. Keep it to 1 or 2 sentences max.`;

  try {
    const result = await askAIBuddy(prompt, []);
    if (result.error) return { error: result.error };

    return { hint: result.text.trim() };
  } catch (error) {
    console.error("Hint generation error:", error);
    return { error: "Failed to generate hint." };
  }
}

export async function generateMoreQuestions(moduleId: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  const module = await prisma.tutorModule.findFirst({
    where: { id: moduleId, userId }
  });

  if (!module) return { error: "Module not found" };

  const existingQuestions = JSON.parse(module.questions);
  const existingQuestionsText = existingQuestions.map((q: any) => q.question).join("\n");

  const prompt = `You are an expert academic tutor. You previously generated a quiz for the subject "${module.subject}".
Here are the existing questions in this module:
${existingQuestionsText}

Generate exactly 5 NEW and UNIQUE questions that cover different aspects of "${module.subject}" or go deeper. Do NOT duplicate the ones above.
Use a rich, varied MIX of these types: MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, FILL_IN_THE_BLANK, SHORT_ANSWER, OPEN_ENDED, MATCHING, ORDERING.

${QUESTION_TYPE_SPEC}

Return ONLY a JSON array of the 5 new question objects (no markdown, no backticks).`;

  try {
    const result = await askAIBuddy(prompt, []);
    if (result.error) return { error: result.error };

    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```')) {
      const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleanJson = match[1];
      } else {
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
      }
    }

    const newQuestions = JSON.parse(cleanJson);
    
    // Ensure unique IDs
    const timestamp = Date.now();
    const processedNewQuestions = newQuestions.map((q: any, i: number) => ({
      ...q,
      id: `gen_${timestamp}_${i}`
    }));

    const updatedQuestions = [...existingQuestions, ...processedNewQuestions];

    await prisma.tutorModule.update({
      where: { id: moduleId },
      data: {
        questions: JSON.stringify(updatedQuestions)
      }
    });

    revalidatePath(`/tutor/${moduleId}`);
    return { success: true };
  } catch (error) {
    console.error("Generate More error:", error);
    return { error: "Failed to generate more questions." };
  }
}

export async function gradeQuizAttempt(moduleId: string, studentAnswers: { id: string, answer: string }[]) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };


  const module = await prisma.tutorModule.findFirst({
    where: { id: moduleId, userId }
  });

  if (!module) return { error: "Module not found" };

  let questions = [];
  try {
    questions = JSON.parse(module.questions);
  } catch (e) {
    return { error: "Failed to parse questions" };
  }

  const gradingPayload = questions.map((q: any) => {
    const studentAnswer = studentAnswers.find(sa => sa.id === q.id)?.answer || "I don't know.";
    return {
      questionId: q.id,
      type: q.type || 'OPEN_ENDED',
      question: q.question,
      expectedAnswer: q.expectedAnswer,
      studentAnswer: studentAnswer
    };
  });


  const prompt = `You are an expert academic tutor grading a student's quiz.
Analyze the student's answers against the expected answers. Be strict but fair.
Grade by question "type": MULTIPLE_CHOICE / TRUE_FALSE must match exactly (correct or not). MULTIPLE_SELECT is fully correct only if the chosen set matches the expected set (order irrelevant). MATCHING is scored by how many term→definition pairs are correct. ORDERING is scored by how close the sequence is. FILL_IN_THE_BLANK accepts close synonyms. SHORT_ANSWER and OPEN_ENDED are graded on conceptual accuracy and completeness.
Here is the JSON payload containing the questions, expected answers, and the student's answers:
${JSON.stringify(gradingPayload, null, 2)}

Provide detailed, constructive feedback for each question.
Calculate an overallScore from 0 to 100.
Determine the understanding level: "Beginner" (0-50), "Intermediate" (51-85), or "Master" (86-100).

Return ONLY a JSON object exactly matching this structure:
{
  "overallScore": 85,
  "understanding": "Intermediate",
  "feedback": [
    {
      "questionId": "q1",
      "isCorrect": true,
      "score": 90,
      "aiFeedback": "Excellent understanding of the concept, but missed a minor detail about..."
    }
  ]
}
Do not include markdown blocks.`;

  try {
    const result = await askAIBuddy(prompt, []);
    if (result.error) return { error: result.error };

    // More robust JSON cleaning
    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```')) {
      const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleanJson = match[1];
      } else {
        // Fallback: just strip the backticks if regex fails
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
      }
    }

    const data = JSON.parse(cleanJson);

    const augmentedFeedback = data.feedback.map((f: any) => ({
      ...f,
      studentAnswer: studentAnswers.find(sa => sa.id === f.questionId)?.answer || ""
    }));

    // Save the attempt history
    await prisma.quizAttempt.create({
      data: {
        moduleId: module.id,
        score: data.overallScore,
        feedback: JSON.stringify(augmentedFeedback)
      }
    });

    // Update the module's best/latest score via the existing function
    await updateTutorModuleScore(module.id, data.overallScore, data.understanding);

    return { success: true, data: { ...data, feedback: augmentedFeedback } };
  } catch (error) {
    console.error("Grading error:", error);
    return { error: "Failed to grade the quiz." };
  }
}

export async function generateFlashcardsForModule(moduleId: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  const module = await prisma.tutorModule.findFirst({
    where: { id: moduleId, userId }
  });

  if (!module) return { error: "Module not found" };

  let contextInfo = "";
  try {
    const questions = JSON.parse(module.questions);
    contextInfo = questions.map((q: any) => `Q: ${q.question}\nA: ${q.expectedAnswer || ""}`).join("\n\n");
  } catch (e) {
    contextInfo = "Subject: " + module.subject;
  }

  const prompt = `You are an expert academic tutor. You are creating a set of study flashcards for the subject "${module.subject}" (Topic: "${module.title}").
Based on the following concepts and questions, generate exactly 10-15 high-quality flashcards:
${contextInfo}

For each flashcard, provide:
1. "id": A unique short identifier (e.g. "fc_1", "fc_2").
2. "front": A concise question, term, or prompt (maximum 2 sentences).
3. "back": A clear, accurate answer or definition (maximum 3 sentences).

Return ONLY a JSON array of flashcards following this exact structure:
[
  {
    "id": "fc_1",
    "front": "What is the primary function of DNA?",
    "back": "DNA stores genetic information used in the development and functioning of living organisms."
  }
]
Do not include markdown formatting or backticks.`;

  try {
    const result = await askAIBuddy(prompt, []);
    if (result.error) return { error: result.error };

    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```')) {
      const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleanJson = match[1];
      } else {
        cleanJson = cleanJson.replace(/```json/g, '').replace(/```/g, '').trim();
      }
    }

    const flashcardsList = JSON.parse(cleanJson);
    const initializedFlashcards = flashcardsList.map((fc: any) => ({
      ...fc,
      interval: 0,
      repetition: 0,
      efactor: 2.5,
      nextReviewDate: new Date().toISOString()
    }));

    await prisma.tutorModule.update({
      where: { id: moduleId },
      data: {
        flashcards: JSON.stringify(initializedFlashcards)
      }
    });

    revalidatePath(`/tutor/${moduleId}`);
    return { success: true, flashcards: initializedFlashcards };
  } catch (error) {
    console.error("Flashcards Generation Error:", error);
    return { error: "Failed to generate flashcards. Please check your AI key." };
  }
}

export async function updateFlashcardsReview(moduleId: string, flashcardsJson: string, xpEarned: number) {
  const userId = await getUserId();
  if (!userId) return { error: "Unauthorized" };

  try {
    await prisma.tutorModule.update({
      where: { id: moduleId },
      data: {
        flashcards: flashcardsJson,
        lastReviewedAt: new Date()
      }
    });

    if (xpEarned > 0) {
      await addXp(userId, xpEarned);
    }

    revalidatePath(`/tutor/${moduleId}`);
    revalidatePath('/tutor');
    return { success: true };
  } catch (error) {
    console.error("Flashcards Update Error:", error);
    return { error: "Failed to save flashcard progress." };
  }
}

