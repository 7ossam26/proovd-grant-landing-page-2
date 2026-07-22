import { CreatorsSection } from "@/components/creators-section";
import { DaysSection } from "@/components/days-section";
import { EvanSection } from "@/components/evan-section";
import { FaqSection } from "@/components/faq-section";
import { Hero } from "@/components/hero";
import { HoverFX } from "@/components/hover-fx";
import { Navbar } from "@/components/navbar";
import { PricingSection } from "@/components/pricing-section";
import { RiskSection } from "@/components/risk-section";
import { FAQS } from "@/lib/faqs";
import { JsonLd } from "@/lib/json-ld";
import { siteConfig } from "@/lib/site-config";

// One @graph: who Proovd is (Organization), the site (WebSite), and the real
// Q&A on this page (FAQPage) — cross-linked by @id. Facts only; no SearchAction
// (there is no site search) and no sameAs (no live profiles yet).
const url = siteConfig.siteUrl;
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${url}/#organization`,
      name: siteConfig.name,
      url,
      logo: `${url}/assets/Proovd%20Logo.webp`,
      description: siteConfig.tagline,
    },
    {
      "@type": "WebSite",
      "@id": `${url}/#website`,
      name: siteConfig.name,
      url,
      description: siteConfig.description,
      publisher: { "@id": `${url}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${url}/#faq`,
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <JsonLd schema={structuredData} />
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
    </>
  );
}
