import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "app/page-save.tsx",
    "app/page-WORKING.tsx",
    "app/page15 copy.tsx",
    "app/page15.tsx",
    "app/page16.tsx",
    "app/page17.tsx",
    "app/page18.tsx",
    "app/pod check.tsx",
    "app/working pod checker 11.tsx",
    "app/working pod checker 12.tsx",
    "app/working pod checker 13.tsx",
    "app/working pod checker 14.tsx",
    "app/components/ScanResultsPanel-save.tsx",
    "app/components/TopControlsPanel-save.tsx",
  ]),
]);

export default eslintConfig;
