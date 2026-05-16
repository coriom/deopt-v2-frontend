import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "DeOpt v2 Admin",
  description: "Read-only DeOpt v2 operations dashboard",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
