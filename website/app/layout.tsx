import type { Metadata } from "next";
import { Geist, Noto_Sans_Devanagari } from "next/font/google";
import { Providers } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-noto-deva", weight: ["400", "500"], subsets: ["devanagari"] });

export const metadata: Metadata = {
  title: "Vera AI | The true record of every site",
  description:
    "AI infrastructure for India's mid-size contractors. Supervisors send WhatsApp voice notes, photos and challans; Vera turns them into a daily record, finds material leaks and gets bills paid.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${deva.variable} antialiased`}
    >
      <head>
        {/* Saved theme applied before paint, landing page only (the /demo desk stays dark). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("vera-theme");if(t&&location.pathname==="/")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <div aria-hidden className="grain" />
      </body>
    </html>
  );
}
