-- Indexes on the Class/Term scope columns and the exam revision link.
--
-- These were created directly in Postgres by the Phase 2 and Phase 5 changes
-- but were never declared in schema.prisma, so the SQLite history derived from
-- that schema never had them. Every scoped query in the app filters on classId
-- or termId, so without these the desktop build full-scans those tables.

-- CreateIndex
CREATE INDEX "AiNote_classId_idx" ON "AiNote"("classId");

-- CreateIndex
CREATE INDEX "DailySummary_termId_idx" ON "DailySummary"("termId");

-- CreateIndex
CREATE INDEX "ExamEvent_subjectId_idx" ON "ExamEvent"("subjectId");

-- CreateIndex
CREATE INDEX "ExamEvent_termId_idx" ON "ExamEvent"("termId");

-- CreateIndex
CREATE INDEX "Homework_termId_idx" ON "Homework"("termId");

-- CreateIndex
CREATE INDEX "MarkedDay_termId_idx" ON "MarkedDay"("termId");

-- CreateIndex
CREATE INDEX "MasteryItem_classId_idx" ON "MasteryItem"("classId");

-- CreateIndex
CREATE INDEX "Project_classId_idx" ON "Project"("classId");

-- CreateIndex
CREATE INDEX "ReportCard_termId_idx" ON "ReportCard"("termId");

-- CreateIndex
CREATE INDEX "Resource_classId_idx" ON "Resource"("classId");

-- CreateIndex
CREATE INDEX "ScheduleTemplate_classId_idx" ON "ScheduleTemplate"("classId");

-- CreateIndex
CREATE INDEX "StudioNote_classId_idx" ON "StudioNote"("classId");

-- CreateIndex
CREATE INDEX "Subject_classId_idx" ON "Subject"("classId");

-- CreateIndex
CREATE INDEX "SubjectGoal_classId_idx" ON "SubjectGoal"("classId");

-- CreateIndex
CREATE INDEX "Task_examId_idx" ON "Task"("examId");

-- CreateIndex
CREATE INDEX "Task_termId_idx" ON "Task"("termId");

-- CreateIndex
CREATE INDEX "TutorModule_classId_idx" ON "TutorModule"("classId");

-- CreateIndex
CREATE INDEX "WeeklySummary_termId_idx" ON "WeeklySummary"("termId");

