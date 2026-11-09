import Answers from "@/components/Answers";
import Closing from "@/components/Closing";
import Desks from "@/components/Desks";
import EightAM from "@/components/EightAM";
import Hero from "@/components/Hero";
import Leak from "@/components/Leak";
import Nav from "@/components/Nav";
import Preloader from "@/components/Preloader";
import Pricing from "@/components/Pricing";
import Process from "@/components/Process";
import Savings from "@/components/Savings";

export default function Home() {
  return (
    <>
      <Preloader />
      <Nav />
      <main>
        <Hero />
        <Leak />
        <Desks />
        <EightAM />
        <Process />
        <Savings />
        <Pricing />
        <Answers />
      </main>
      <Closing />
    </>
  );
}
