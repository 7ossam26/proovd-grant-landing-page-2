import { CreatorsSection } from "@/components/creators-section";
import { DaysSection } from "@/components/days-section";
import { EvanSection } from "@/components/evan-section";
import { FaqSection } from "@/components/faq-section";
import { Hero } from "@/components/hero";
import { HoverFX } from "@/components/hover-fx";
import { Navbar } from "@/components/navbar";
import { PricingSection } from "@/components/pricing-section";
import { RiskSection } from "@/components/risk-section";

export default function Home() {
  return (
    <main>
      <Hero />
      <Navbar />
      <EvanSection />
      <CreatorsSection />
      <RiskSection />
      <DaysSection />
      <PricingSection />
      <FaqSection />
      <HoverFX />
    </main>
  );
}
