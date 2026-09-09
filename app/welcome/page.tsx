import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WelcomeClient } from "./WelcomeClient";
import { DESKTOP_DOWNLOAD_URL, desktopVersion } from "@/lib/desktop-release";

export default async function WelcomePage() {
  const userId = await getUserId();
  if (userId) redirect('/');

  return (
    <WelcomeClient
      downloadUrl={DESKTOP_DOWNLOAD_URL}
      downloadVersion={desktopVersion()}
    />
  );
}
