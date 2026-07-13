/**
 * Renders a JSON-LD structured-data block as
 * `<script type="application/ld+json">`.
 *
 * Pass any schema.org object (or an array / an object using "@graph").
 * No schemas are hardcoded here — define them at the call site. Example:
 *
 *   <JsonLd
 *     schema={{
 *       "@context": "https://schema.org",
 *       "@type": "Organization",
 *       name: "Proovd",
 *       url: "https://proovd.com",
 *       logo: "https://proovd.com/logo.png",
 *     }}
 *   />
 *
 *   <JsonLd
 *     schema={{
 *       "@context": "https://schema.org",
 *       "@type": "WebSite",
 *       name: "Proovd",
 *       url: "https://proovd.com",
 *     }}
 *   />
 */
export type JsonLdSchema =
  | Record<string, unknown>
  | ReadonlyArray<Record<string, unknown>>;

export function JsonLd({ schema }: { schema: JsonLdSchema }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw <script> injection; the payload is JSON.stringify'd with "<" escaped.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
