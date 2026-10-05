import { redirect } from "next/navigation";

// The first screen is always authentication; the login page forwards signed-in users to the dashboard.
export default function Home() {
  redirect("/login");
}
