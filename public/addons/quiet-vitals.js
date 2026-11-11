/* Console silencer for the minified app bundle's web-vitals debug output
   (FCP/TTFB/LCP/FID/CLS/INP objects printed by the CRA build — harmless but
   noisy; owner request 2026-11-08: none of it should show).
   The addon layer must NOT touch the bundle, so we filter the console
   methods: any call whose FIRST argument looks like a web-vitals metric
   object (name/value/delta/entries/id) is dropped across log/info/debug;
   everything else passes through untouched. error/warn stay open — real
   problems must still surface.
*/
(() => {
  "use strict";
  if (window.__bcaQuietVitals) return;
  window.__bcaQuietVitals = true;

  const VITAL_NAMES = ["FCP", "TTFB", "LCP", "FID", "CLS", "INP", "Next.js-hydration", "Navigation"];
  const isVitalDump = (args) => {
    if (!args.length || !args[0] || typeof args[0] !== "object") return false;
    const o = args[0];
    return typeof o.name === "string"
      && VITAL_NAMES.includes(o.name)
      && "value" in o
      && "delta" in o
      && "id" in o
      && "entries" in o;
  };

  const quiet = (level) => {
    const orig = console[level].bind(console);
    console[level] = (...args) => { if (!isVitalDump(args)) orig(...args); };
  };
  quiet("log");
  quiet("info");
  quiet("debug");
})();
