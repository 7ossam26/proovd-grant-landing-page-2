import { CreatorsSection } from "@/components/creators-section";
import { DaysSection } from "@/components/days-section";
import { EvanSection } from "@/components/evan-section";
import { FaqSection } from "@/components/faq-section";
import { GuidesSection } from "@/components/guides-section";
import { Hero } from "@/components/hero";
import { HoverFX } from "@/components/hover-fx";
import { IntroGate } from "@/components/intro-gate";
import { Navbar } from "@/components/navbar";
import { PricingSection } from "@/components/pricing-section";
import { RiskSection } from "@/components/risk-section";
import { TabletBlock } from "@/components/tablet-block";
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

/** Parse-time media kick. Assigns the intro's video srcs the moment the
 *  gate's HTML exists — SECONDS before hydration on a slow connection, which
 *  is exactly where the intro was losing its own media races (probed on the
 *  live site: hydration landed at ~5.5s under Fast 3G, so the 768 KB crank
 *  never showed and the stinger was still buffering at the pick). The gate's
 *  effect checks currentSrc before (re)arming, so this head start is never
 *  thrown away (intro-gate.tsx).
 *
 *  Mirrors the gate's own gates 1:1 — reduced motion, Save-Data, the tablet
 *  cover, mp4 support, and the ≤700px posture pick. KEEP THE QUERIES IN SYNC
 *  with intro-gate.tsx (TABLET_QUERY / PHONE_QUERY / canPlayMp4) and
 *  tablet-block.module.css: this script exists precisely because it runs
 *  before any module code can. */
const MEDIA_KICK = `(function(){try{
var M=window.matchMedia;
if(M("(prefers-reduced-motion: reduce)").matches)return;
var c=navigator.connection;if(c&&c.saveData)return;
if(M("(min-width: 701px) and (max-width: 1023px),(min-width: 701px) and (pointer: coarse),(min-width: 701px) and (max-height: 599px)").matches)return;
var p=document.createElement("video");
if(typeof p.canPlayType!=="function")return;
if(p.canPlayType('video/mp4; codecs="avc1.42E01E"')===""&&p.canPlayType("video/mp4")==="")return;
var k=document.querySelector("[data-gate-crank]");
if(k&&!k.getAttribute("src")){k.src="/assets/crank-load.mp4";k.preload="auto";k.load();}
var v=document.querySelector("[data-gate-clip]");
if(v&&!v.getAttribute("src")){v.src=M("(max-width: 700px)").matches?"/assets/mobile-video.mp4":"/assets/desktop-video.mp4";v.preload="auto";v.load();}
}catch(e){}})();`;

export default function Home() {
  return (
    <>
      <JsonLd schema={structuredData} />
      {/* Covers everything below, including the intro gate, on tablets. */}
      <TabletBlock />
      <IntroGate />
      {/* Must sit AFTER <IntroGate /> — it targets the gate's <video>
          elements, and a parser-executed script only sees markup above it. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, zero interpolation; it must execute at parse time, before hydration, which no component code can.
        dangerouslySetInnerHTML={{ __html: MEDIA_KICK }}
      />
      <main>
        <Hero />
        <Navbar />
        <EvanSection />
        <CreatorsSection />
        <RiskSection />
        <DaysSection />
        <GuidesSection />
        <PricingSection />
        <FaqSection />
        <HoverFX />
      </main>
    </>
  );
}
