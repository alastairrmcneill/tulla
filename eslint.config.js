// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Deno runtime (Supabase Edge Functions) — separate toolchain, not part
    // of the RN app's lint/type project.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
