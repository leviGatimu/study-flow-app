import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginClient } from "./LoginClient";

export default async function LoginPage() {
  const userId = await getUserId();
  if (userId) redirect('/');

  return <LoginClient />;
}
