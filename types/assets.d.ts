// Ambient declarations for static asset imports (so importing a font file
// yields its emitted URL string). Used to preload the brand font by its exact
// hashed URL — see app/layout.tsx.
declare module "*.woff2" {
  const src: string;
  export default src;
}
