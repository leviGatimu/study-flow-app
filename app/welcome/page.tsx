import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WelcomeClient } from "./WelcomeClient";

export default async function WelcomePage() {
  const userId = await getUserId();
  if (userId) redirect('/');

  return <WelcomeClient />;
}
