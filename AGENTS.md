You are an expert Full-Stack Developer specializing in Next.js (App Router), React, Tailwind CSS, and local SQL databases (using SQLite and Prisma ORM). 

My goal is to build a personal, local-only "Study & Assignment Tracker" web application to help me manage my school schedule and pass my exams. There is NO need for authentication or user login. The app should be entirely locally hosted for my personal use.

Please build this application from the ground up, providing the necessary terminal commands, folder structure, and complete code for each file.

### 1. Technology Stack
* **Framework:** Next.js (App Router, TypeScript).
* **Styling:** Tailwind CSS + Shadcn UI (for clean, accessible components like cards, dialogs, and forms).
* **Database:** SQLite (local file).
* **ORM:** Prisma.
* **Icons:** Lucide React.
* **State Management:** React Context or standard React hooks.

### 2. Database Schema (Prisma)
Create a Prisma schema with a recurring template engine. I need two models:

Model: `ScheduleTemplate` (The weekly recurring base)
* `id` (String, Primary Key)
* `dayOfWeek` (Int - 0 for Sunday, 1 for Monday, etc.)
* `subject` (String)
* `startTime` (String - format "HH:MM" 24hr)
* `endTime` (String - format "HH:MM" 24hr)
* `deadlineDay` (String)
* `type` (String - MUST be either "HOMEWORK" or "REVISION")

Model: `Task` (The actual daily instances)
* `id` (String, Primary Key)
* `templateId` (String, Foreign Key mapping back to ScheduleTemplate)
* `date` (DateTime - the specific calendar date this task falls on)
* `subject` (String)
* `isDone` (Boolean - default: false)
* `type` (String - "HOMEWORK" or "REVISION")

**Automation Logic Requirement:** Every time the Dashboard loads, the app should check the current day of the week, look up the `ScheduleTemplate` for that day, and automatically generate/insert the `Task` entries for that specific calendar date if they don't already exist.

### 3. Core Features & UI Layout
The application should have responsive sidebar navigation and the following main views:

**A. Dashboard (Home / Index)**
* **Hero Section:** A clean header displaying this exact quote: "Whatever your hand finds to do, do it with all your might, for in the realm of the dead, where you are going, there is neither working nor planning nor knowledge nor wisdom." (Ecclesiastes 9:10) [cite: 16, 17, 18].
* **Today's Schedule:** A timeline showing exactly what I need to do TODAY, ordered by `startTime`.
* **Visual Distinction:** Render "HOMEWORK" tasks with a solid primary color border (e.g., blue) and "REVISION" tasks with a distinct secondary color border (e.g., dashed orange) so I instantly know my focus mode.
* **Quick Actions:** A one-click toggle to mark a task as "Done".
* **Daily Progress:** A progress bar showing completed vs. pending tasks for today.

**B. Full Calendar View**
* A classic month/week grid view displaying all assignments and revision blocks.
* Allow clicking on a specific day to open a modal showing that day's specific tasks and deadlines.

**C. Manual Input & History**
* A page to manually add one-off tasks or create new recurring `ScheduleTemplates`.
* A "History" page showing all tasks marked as `isDone: true` to track my completed work.

### 4. Seed Data Requirement (`seed.ts`)
Provide a `seed.ts` script to populate the `ScheduleTemplate` table with my exact weekly routine[cite: 1]. Use the following data (I have corrected typos in the original days):

**Monday** [cite: 2]
* Subject: Networking, Time: 20:00 - 20:30, Deadline: Monday, Type: HOMEWORK[cite: 3].
* Subject: Javascript, Time: 20:30 - 21:30, Deadline: Monday, Type: HOMEWORK[cite: 3].
* Subject: Embedded system, Time: 20:00 - 20:30, Deadline: Tuesday, Type: HOMEWORK[cite: 3].

**Tuesday** [cite: 4]
* Subject: PHP, Time: 20:00 - 21:30, Deadline: Wednesday, Type: HOMEWORK[cite: 5].
* Subject: Entrepreneurship, Time: 21:30 - 22:00, Deadline: Tuesday, Type: HOMEWORK[cite: 5].
* Subject: English, Time: 22:00 - 23:30, Deadline: Tuesday, Type: HOMEWORK[cite: 5].

**Wednesday** [cite: 6]
* Subject: Physics, Time: 19:00 - 21:30, Deadline: Friday, Type: HOMEWORK[cite: 7].
* Subject: Database, Time: 21:30 - 22:30, Deadline: Thursday, Type: HOMEWORK[cite: 7].
* Subject: C programming, Time: 22:30 - 23:30, Deadline: Thursday, Type: HOMEWORK[cite: 7].

**Thursday** [cite: 8]
* Subject: Math, Time: 19:00 - 21:30, Deadline: Sunday, Type: HOMEWORK[cite: 9].
* Subject: Web UI, Time: 21:30 - 22:30, Deadline: Thursday, Type: HOMEWORK[cite: 9].
* Subject: Physics, Time: 22:30 - 00:00, Deadline: Thursday, Type: HOMEWORK[cite: 9].

**Friday** [cite: 10]
* Subject: Math (revision), Time: 20:00 - 21:30, Deadline: Friday, Type: REVISION[cite: 11].
* Subject: C (revision), Time: 21:30 - 22:30, Deadline: Friday, Type: REVISION[cite: 11].
* Subject: Physics (Revision), Time: 22:30 - 00:00, Deadline: Friday, Type: REVISION[cite: 11].

**Saturday** [cite: 12]
* Subject: Javascript (revision), Time: 18:00 - 20:30, Deadline: Saturday, Type: REVISION[cite: 13].
* Subject: Physics (revision), Time: 20:30 - 22:00, Deadline: Saturday, Type: REVISION[cite: 13].

**Sunday** [cite: 14]
* Subject: Embedded system (revision), Time: 19:00 - 20:30, Deadline: Sunday, Type: REVISION[cite: 15].
* Subject: PHP (revision), Time: 20:30 - 22:00, Deadline: Sunday, Type: REVISION[cite: 15].

### 5. Implementation Steps
Please execute the build in the following order:
1. Provide the Next.js API routes (GET, POST, PUT) for tasks and the automated template generator.
2. Provide the code for the Dashboard layout and main page.
3. Provide the code for the Calendar and History views.

Here you go. This prompt gives the AI the exact blueprint for your app's architecture. It breaks down every single page, what components belong there, and how the layout should be structured.

I wrote it from your perspective, and I included a note for the AI to optimize the design for wider screens or dual-monitor setups, so it actually takes advantage of your workspace instead of just looking like a stretched-out mobile app.

The App Architecture & Page Rundown Prompt
Copy everything below this line and feed it to your AI builder:

Plaintext
You are an expert Frontend Developer and UI/UX Designer. I need you to build out the specific pages for my Next.js "Study & Assignment Tracker". 

Below is the exact architecture and the rundown of everything that needs to be on each page. Please generate the code for these pages using Tailwind CSS and Shadcn UI components. Ensure the layouts are responsive but take full advantage of wide-screen or dual-monitor setups (e.g., using grid layouts to show multiple panels side-by-side rather than a single narrow column).

### 1. The Sidebar Navigation (Global Component)
* **Location:** Fixed on the left side of the screen (or bottom bar on mobile).
* **Links Needed:** * "Dashboard" (Icon: Home)
    * "Calendar" (Icon: Calendar)
    * "History" (Icon: CheckCircle)
    * "Manage Schedule" (Icon: Settings)
* **Action Button:** A prominent "Add Task" button at the bottom or top of the sidebar to trigger the quick-add modal from anywhere.

### 2. Page 1: Dashboard (`/`)
This is the command center and the default landing page.
* **Top Bar/Hero:** * Display the current date and time dynamically.
    * Display the quote: "Whatever your hand finds to do, do it with all your might..."
* **Main Content Area (Split into two columns on large screens):**
    * **Left Column (Today's Focus):** A vertical timeline of today's tasks, ordered by time. Must clearly distinguish "HOMEWORK" (solid border) vs "REVISION" (dashed border). Each item must have a "Mark Done" checkbox.
    * **Right Column (Quick Overview):** A small progress widget (e.g., a circular progress ring showing today's completion percentage) and a "Tomorrow at a Glance" list so I know what's coming up.

### 3. Page 2: Full Calendar (`/calendar`)
* **Top Bar:** Month/Year selector and "Today" button to snap back to the current week.
* **Main Content:** A full CSS grid calendar. 
    * Days that have tasks should display small color-coded dot indicators (e.g., blue dot for homework, orange dot for revision).
    * Clicking a grid square opens a Modal showing the full list of that day's subjects, times, and personal deadlines. Closing this modal must simply return the user to the calendar grid.

### 4. Page 3: History & Completed Work (`/history`)
* **Top Bar:** Simple title "Completed Work" and maybe a dropdown to filter by "Last 7 Days", "Last 30 Days", or "All Time".
* **Main Content:** A table or list layout showing every task where `isDone === true`.
    * Columns/Fields: Date Completed, Subject, Type (Homework/Revision), and Original Deadline.
    * This page should feel like a satisfying log of hard work.

### 5. Page 4: Manage Schedule (`/manage`)
This page manages the recurring `ScheduleTemplate` database so I can update my semester timetable without touching the code.
* **Top Bar:** "Weekly Timetable Settings".
* **Main Content:** * Grouped by days of the week (Monday - Sunday).
    * Under each day, list the recurring tasks (e.g., "Monday: Networking 8pm-8:30pm").
    * Include "Edit" and "Delete" buttons next to each template.
    * A prominent "Add Class to Timetable" button that opens a form to add a new recurr