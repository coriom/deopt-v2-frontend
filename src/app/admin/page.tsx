import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "DeOpt Admin",
  description: "Read-only DeOpt operations dashboard",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
