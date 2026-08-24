import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * أنماط ممنوعة تُعبّر عن حدود الطبقات في Clean Architecture.
 * التبعية تتّجه للداخل فقط: presentation → application → core،
 * و infrastructure → application/core.
 */
const FORBID_FRAMEWORKS = [
  {
    group: ["react", "react-dom", "react/*", "react-dom/*"],
    message: "طبقة نقية: ممنوع استيراد React هنا.",
  },
  {
    group: ["@supabase/*"],
    message: "ممنوع استيراد Supabase خارج طبقة infrastructure.",
  },
  { group: ["@tanstack/*"], message: "طبقة نقية: ممنوع استيراد مكتبات الواجهة هنا." },
];

const FORBID_INFRA = [
  {
    group: ["@infrastructure/*", "**/infrastructure/**"],
    message: "ممنوع الاعتماد على infrastructure من هذه الطبقة.",
  },
];

const FORBID_PRESENTATION = [
  {
    group: ["@presentation/*", "**/presentation/**"],
    message: "ممنوع الاعتماد على presentation من هذه الطبقة.",
  },
];

const FORBID_APPLICATION = [
  {
    group: ["@application/*", "**/application/**"],
    message: "core لا يعرف شيئًا عن application.",
  },
];

const FORBID_CONFIG = [
  {
    group: ["@config/*", "**/config/**", "@i18n/*", "**/i18n/**"],
    message: "طبقة نقية: الإعدادات والنصوص تُمرَّر كمدخلات لا تُستورد.",
  },
];

export default defineConfig([
  // Edge Functions تعمل على Deno ولها أدواتها الخاصة
  globalIgnores(["dist", "supabase/functions/**", "coverage"]),

  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      // المواصفات: ممنوع any وممنوع enum
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "ممنوع استخدام enum — استخدم union types أو as const.",
        },
      ],
    },
  },

  // ── core: طبقة الدومين الخالصة ──────────────────────────────────────────
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...FORBID_FRAMEWORKS,
            ...FORBID_APPLICATION,
            ...FORBID_INFRA,
            ...FORBID_PRESENTATION,
            ...FORBID_CONFIG,
          ],
        },
      ],
    },
  },

  // ── application: Use Cases + Ports ──────────────────────────────────────
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...FORBID_FRAMEWORKS,
            ...FORBID_INFRA,
            ...FORBID_PRESENTATION,
            ...FORBID_CONFIG,
          ],
        },
      ],
    },
  },

  // ── presentation: React فقط، بلا أي وصول مباشر لقاعدة البيانات ──────────
  {
    files: ["src/presentation/**/*.{ts,tsx}", "src/App.tsx", "src/main.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message: "طبقة العرض لا تلمس Supabase — استخدم use-case محقونًا عبر DI.",
            },
            {
              group: ["@infrastructure/supabase/*", "**/infrastructure/supabase/**"],
              message:
                "طبقة العرض لا تصل إلى عميل Supabase — استخدم use-case محقونًا عبر DI.",
            },
            {
              group: ["@infrastructure/repositories/*", "@infrastructure/services/*"],
              message: "طبقة العرض لا تنشئ Adapters بنفسها — اسحبها من DI container.",
            },
          ],
        },
      ],
    },
  },

  // ملفات الاختبار تحتاج حرية أوسع
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
      "react-refresh/only-export-components": "off",
    },
  },

  prettier,
]);
