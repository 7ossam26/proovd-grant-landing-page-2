import Script from "next/script";

/**
 * Analytics loaders — Microsoft Clarity + self-hosted Umami.
 *
 * Server-safe (renders on the server, no "use client"). Both providers are
 * gated on `NODE_ENV === "production"` AND the presence of their env vars, so
 * nothing is emitted — and no third-party requests happen — in development.
 */
export function Analytics() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <>
      {clarityId ? (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      ) : null}

      {umamiSrc && umamiWebsiteId ? (
        <Script
          src={umamiSrc}
          data-website-id={umamiWebsiteId}
          strategy="afterInteractive"
          defer
        />
      ) : null}
    </>
  );
}
