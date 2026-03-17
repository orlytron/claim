import { loadSession } from "../lib/session";
import SideNav from "./SideNav";

export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  const session = await loadSession();

  return (
    <div className="flex min-h-screen bg-white">
      <SideNav session={session} />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
