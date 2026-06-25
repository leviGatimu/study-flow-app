import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import TutorClient from "./TutorClient";

export default async function TutorPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  return <TutorClient />;
}
