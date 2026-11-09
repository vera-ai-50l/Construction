import type { Metadata } from "next";
import HQ from "@/components/HQ";

export const metadata: Metadata = {
  title: "HQ · The climb to ₹50L",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HQ />;
}
