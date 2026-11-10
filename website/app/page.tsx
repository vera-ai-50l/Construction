import Closing from "@/components/Closing";
import Desks from "@/components/Desks";
import Hero from "@/components/Hero";
import Leak from "@/components/Leak";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Process from "@/components/Process";
import Team from "@/components/Team";

export default function Home() {
  return (
    <>
      <Preloader />
      <Nav />
      <main>
        <Hero />
        <Leak />
        <Desks />
        <Process />
        <Team />
      </main>
      <Closing />
    </>
  );
}
