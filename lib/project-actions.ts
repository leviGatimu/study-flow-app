'use server';

import { prisma } from '@/lib/prisma';
import { softDelete } from '@/lib/soft-delete';
import { getUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getViewScope, byClass, requireClassStamp, assertWritableScope } from '@/lib/scope';

export async function getProjects() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.project.findMany({
    where: { userId, ...byClass(await getViewScope(userId)) },
    // A nested include is out of the extension's reach, so it filters itself.
    include: { docs: { where: { deletedAt: null } } },
    orderBy: { updatedAt: 'desc' }
  });
}

export async function getProjectById(id: string) {
  const userId = await getUserId();
  if (!userId) return null;

  return prisma.project.findFirst({
    where: { id, userId },
    include: { docs: true }
  });
}

export async function createProject(data: { title: string, description?: string }) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const project = await prisma.project.create({
    data: { ...data, userId, ...(await requireClassStamp(userId)) }
  });

  revalidatePath('/projects');
  return project;
}

export async function updateProjectProgress(id: string, progress: number) {
  const userId = await getUserId();
  if (!userId) return;

  // A finished year is a record, not a workspace. The UI hides these
  // controls inside an archive; this is the guarantee behind that, because
  // hidden is not the same as prevented.
  await assertWritableScope(userId);

  await prisma.project.updateMany({
    where: { id, userId },
    data: { progress }
  });

  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  const userId = await getUserId();
  if (!userId) return;

  await assertWritableScope(userId);

  await softDelete(prisma, 'project', { id, userId });

  revalidatePath('/projects');
}

export async function createProjectDoc(projectId: string, data: { title: string, content: string }) {
  const userId = await getUserId();
  if (!userId) throw new Error("Unauthorized");

  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new Error("Project not found");

  const doc = await prisma.projectDoc.create({
    data: { ...data, projectId }
  });

  revalidatePath(`/projects/${projectId}`);
  return doc;
}

export async function updateProjectDoc(id: string, projectId: string, data: { title?: string, content?: string }) {
  const userId = await getUserId();
  if (!userId) return;

  const doc = await prisma.projectDoc.findFirst({
    where: { id, projectId, project: { userId } },
  });
  if (!doc) return;

  await prisma.projectDoc.update({
    where: { id },
    data
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectDoc(id: string, projectId: string) {
  const userId = await getUserId();
  if (!userId) return;

  const doc = await prisma.projectDoc.findFirst({
    where: { id, projectId, project: { userId } },
  });
  if (!doc) return;

  await softDelete(prisma, 'projectDoc', { id });

  revalidatePath(`/projects/${projectId}`);
}
