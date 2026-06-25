import { getTaskById, getResources, getTodayTasks } from '@/lib/actions';
import { getSongs, getPlaylists } from '@/lib/music-actions';
import { FocusSessionUI } from '@/components/FocusSessionUI';
import { notFound, redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function FocusPage({ params }: { params: Promise<{ taskId: string }> }) {
  const userId = await getUserId();
  if (!userId) {
    redirect('/login');
  }

  const resolvedParams = await params;
  const taskId = decodeURIComponent(resolvedParams.taskId).trim();
  let task;
  
  if (taskId === 'free') {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    task = {
      id: 'free',
      userId: userId,
      templateId: null,
      date: new Date(),
      startTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      endTime: oneHourLater.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      subject: 'Custom Focus',
      isDone: false,
      isMissed: false,
      isDeleted: false,
      type: 'FREE',
      template: null,
      workDescription: null,
      proofPdfUrl: null
    };
  } else {
    task = await getTaskById(taskId);
  }
  
  if (!task) {
    notFound();
  }

  const resources = taskId === 'free' ? [] : await getResources(task.subject);
  const [songs, playlists] = await Promise.all([getSongs(), getPlaylists()]);
  const todayTasks = await getTodayTasks();
  const upcomingTasks = todayTasks.filter((t: any) => !t.isDone && t.id !== taskId);

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-hidden">
      <FocusSessionUI task={task as any} resources={resources} songs={songs} playlists={playlists} upcomingTasks={upcomingTasks} />
    </div>
  );
}
