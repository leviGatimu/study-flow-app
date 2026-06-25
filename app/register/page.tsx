import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegisterClient } from "./RegisterClient";

export default async function RegisterPage() {
  const userId = await getUserId();
  if (userId) redirect('/');

  return <RegisterClient />;
}
