import { redirect } from "next/navigation";

// OPTIONS-ROUTE-RENAMING-V1 — canonical route is now `/options`.
// `/trade` is kept as a server-side redirect so existing bookmarks,
// landing-page CTAs, embedded links and operator muscle memory keep
// working without 404ing.
export default function TradeRedirect() {
  redirect("/options");
}
