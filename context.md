# CONTEXT.md — نظام إدارة شركات المقاولات (Contracting ERP)

> هذا الملف هو المرجع الوحيد الذي يعتمد عليه **Claude Code** لتنفيذ المشروع.
> اقرأه بالكامل قبل كتابة أي سطر كود، والتزم بالبنية والاصطلاحات الموضّحة أدناه حرفيًا.
> الشرح بالعربية، لكن **كل الأكواد والمعرّفات (identifiers) والجداول والأعمدة بالإنجليزية**.

---

## 0. TL;DR للـ Agent

- **الهدف:** نظام ERP لشركة مقاولات يغطّي 5 وحدات: المشتريات، المراسلات والتقييم، المخازن، الحسابات، شؤون الموظفين (HR).
- **التقنيات:** React 18 + TypeScript (strict) + Vite + TailwindCSS + Supabase (Postgres + Auth + RLS + Edge Functions) + **Cloudinary** لتخزين وإدارة الملفات والصور.
- **المعمارية:** Clean Architecture بأربع طبقات (`core` / `application` / `infrastructure` / `presentation`) مع فصل تام للمنطق عن Supabase عبر الـ Ports/Adapters.
- **قاعدة ذهبية من المواصفات:** «تُدخَل المعلومة مرة واحدة فقط، والبرنامج يستدعيها عند تحرير أي مستند» — لا إدخال يدوي مكرّر، والقيود المحاسبية تُسجّل **آليًا بدون تدخل بشري**.
- **الواجهة:** عربية بالكامل، اتجاه **RTL**، تصميم نظيف قابل للتعديل.
- **البدء:** ابدأ بالمرحلة `Phase 0` ثم `Phase 1` بالترتيب في قسم _خارطة الطريق_. لا تقفز للأمام.

---

## 1. نظرة عامة على المشروع

النظام يخدم شركة مقاولات بمشاريع متعددة ومواقع متعددة. الفكرة المحورية المتكررة في كل الوحدات:

1. **الإدخال مرة واحدة (Single Source of Truth):** أي بيان (صنف، مورد، مقاول، مشروع، سعر، كمية) يُدخَل مرة واحدة ويُكوَّد، ثم يُستدعى في كل مستند لاحق دون إعادة كتابة.
2. **الأتمتة الكاملة للقيود:** بمجرد اعتماد/تحويل أي مستند، يُسجّل القيد المحاسبي (استحقاق / صرف / ذمم) **آليًا** عبر Postgres triggers/functions أو Edge Functions — لا يوجد قيد يدوي إلا بصلاحية خاصة تُفتح وتُغلق.
3. **محرّك سير عمل مركزي (Workflow Engine):** كل «معاملة» (خطاب، مستخلص، عهدة، طلب احتياج...) تمرّ بمراحل، لكل مرحلة موظف ومدة زمنية وعدّاد وألوان حالة ودرجة تقييم.
4. **الصلاحيات والمشاريع:** «ليس من حق أي أحد التوقيع على شيء يخص مشروعًا هو غير معتمد عليه» — هذا قيد أمني يتكرر في كل الوحدات ويُطبَّق عبر RLS.

---

## 2. التقنيات وسبب اختيارها

| الطبقة         | التقنية                             | الملاحظات                                                                                 |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Build/Dev      | **Vite**                            | سريع، دعم TS/JSX ممتاز.                                                                   |
| UI             | **React 18 + TypeScript (strict)**  | مكوّنات دالّية + Hooks فقط. لا Class Components.                                          |
| Styling        | **TailwindCSS**                     | مع دعم RTL (`dir="rtl"`)، Design tokens في `tailwind.config.ts`.                          |
| State (server) | **@tanstack/react-query**           | كل جلب/تعديل بيانات يمرّ عبره (caching + optimistic updates).                             |
| State (client) | **Zustand**                         | حالة واجهة خفيفة فقط (UI state، فلاتر). لا تضع بيانات السيرفر فيه.                        |
| Forms          | **react-hook-form + zod**           | zod هي مصدر التحقق (validation) وتُشتق منها أنواع TS.                                     |
| Routing        | **react-router-dom v6**             | Routes محمية بالصلاحيات.                                                                  |
| Backend        | **Supabase**                        | Postgres + Auth + RLS + Edge Functions (Deno). **لا نستخدم Supabase Storage.**            |
| Files/Media    | **Cloudinary**                      | تخزين ورفع الصور والملفّات (صور الفواتير، صور المعدّات، مرفقات المنشآت، مستندات العمالة). |
| DB access      | **@supabase/supabase-js**           | داخل طبقة `infrastructure` فقط — ممنوع استيراده في `presentation` أو `core`.              |
| Tables/Grids   | **@tanstack/react-table**           | للجداول الكثيفة (الموردين، الأصناف، التقارير).                                            |
| Dates          | **dayjs** (بالتقويم/التوطين العربي) | لحساب المدد وأوقات العمل.                                                                 |
| Charts         | **recharts**                        | للتقارير والمقارنات.                                                                      |
| Icons          | **lucide-react**                    | —                                                                                         |
| Testing        | **Vitest + Testing Library**        | اختبارات use-cases و mappers إلزامية.                                                     |
| Lint/Format    | **ESLint + Prettier**               | مع قاعدة تمنع استيراد `infrastructure` من `core`.                                         |

> **قرار معماري مهم:** المنطق الحسّاس (القيود التلقائية، العدّادات، انتقال حالات سير العمل، كشف تكرار الفواتير، ترحيل كشوف البنك) يُنفَّذ في **Postgres (functions + triggers)** و**Edge Functions**، وليس في المتصفّح. الواجهة تعرض النتيجة وتطلق العملية فقط. هذا يضمن التناسق ويمنع التلاعب.

> **قرار التخزين (Cloudinary):** كل الملفّات والصور تُخزَّن في **Cloudinary** لا في Supabase Storage. الرفع يتم **بتوقيع آمن (signed upload)**: الـ `api_secret` يبقى في الخادم داخل Edge Function `sign-cloudinary-upload` التي تُصدر توقيعًا مؤقّتًا، ثم يرفع المتصفّح الملف مباشرة إلى Cloudinary بهذا التوقيع. **ممنوع** وضع `api_secret` في الواجهة أو استخدام رفع غير موقّع (unsigned) للمستندات الحسّاسة. نخزّن في قاعدة البيانات **`public_id` و`secure_url`** الراجعين من Cloudinary فقط (لا الملف نفسه). الوصول للطبقات يمرّ عبر منفذ `IFileStorage` (القسم 3.4) حتى يبقى المزوّد قابلًا للاستبدال.

---

## 3. المعمارية (Clean Architecture)

### 3.1 المبدأ

التبعية تتّجه للداخل فقط: `presentation → application → core`، و`infrastructure → application/core`.
**لا يعرف `core` شيئًا عن React أو Supabase. لا يعرف `application` شيئًا عن React أو Supabase.**

```
core (Domain)  ← application (Use Cases + Ports)  ← infrastructure (Supabase Adapters)
                                                   ← presentation (React UI)
```

- `core` يعرّف الكيانات وقواعد العمل الخالصة.
- `application` يعرّف الـ Use Cases وواجهات المنافذ (Ports) — مثل `IMaterialRequestRepository`.
- `infrastructure` يحقّق تلك الـ Ports باستخدام Supabase (Adapters + Mappers).
- `presentation` يستهلك الـ Use Cases عبر Hooks، ولا يلمس Supabase مباشرة.

### 3.2 بنية المجلدات (اتّبعها حرفيًا)

```
src/
├── core/                          # طبقة الدومين — خالصة، بلا أي إطار عمل
│   ├── shared/
│   │   ├── entities/              # BaseEntity, AuditableEntity
│   │   ├── value-objects/         # Money, DateRange, Quantity, Code
│   │   ├── errors/                # DomainError, ValidationError...
│   │   └── result.ts              # Result<T, E> بدل رمي الاستثناءات
│   └── modules/
│       ├── procurement/entities/  # Item, BoqItem, MaterialRequest...
│       ├── correspondence/entities/
│       ├── warehouse/entities/
│       ├── accounting/entities/
│       └── hr/entities/
│
├── application/                   # طبقة التطبيق — Use Cases + Ports
│   ├── shared/
│   │   ├── ports/                 # IClock, IIdGenerator, ITransactionRunner, IFileStorage
│   │   └── use-case.ts            # UseCase<Input, Output> interface
│   └── modules/
│       ├── procurement/
│       │   ├── ports/             # IMaterialRequestRepository, ISupplierRepository...
│       │   ├── use-cases/         # CreateMaterialRequest, ComparePrices...
│       │   └── dtos/
│       ├── correspondence/
│       ├── warehouse/
│       ├── accounting/
│       └── hr/
│
├── infrastructure/                # طبقة البنية التحتية — Supabase فقط هنا
│   ├── supabase/
│   │   ├── client.ts              # إنشاء العميل الوحيد
│   │   ├── database.types.ts      # مولّد آليًا من Supabase (لا تحرّره يدويًا)
│   │   └── repositories/          # Adapters تحقّق Ports طبقة application
│   ├── mappers/                   # DB Row ⇄ Domain Entity
│   ├── services/                  # CloudinaryFileStorage (يحقّق IFileStorage), AuthService, EdgeFnClient
│   └── di/                        # Composition Root: container.ts
│
├── presentation/                  # طبقة العرض — React
│   ├── app/
│   │   ├── App.tsx
│   │   ├── providers/             # QueryClient, Auth, Theme, RTL, DI
│   │   └── router/                # routes.tsx + ProtectedRoute + PermissionGate
│   ├── shared/
│   │   ├── ui/                    # نظام التصميم: Button, Input, Table, Modal...
│   │   ├── layouts/               # AppShell, Sidebar, Topbar (RTL)
│   │   ├── hooks/                 # useCurrentUser, usePermission, useDebounce
│   │   └── lib/                   # cn(), formatters (عربي), constants
│   └── features/                  # ميزات موزّعة حسب الوحدة
│       ├── procurement/{pages,components,hooks}/
│       ├── correspondence/{pages,components,hooks}/
│       ├── warehouse/{pages,components,hooks}/
│       ├── accounting/{pages,components,hooks}/
│       └── hr/{pages,components,hooks}/
│
├── config/                        # env, feature flags, app constants
├── i18n/                          # نصوص عربية (ar.ts) — لا نصوص مضمّنة في المكوّنات
└── main.tsx

supabase/
├── migrations/                    # ملفات SQL مرقّمة زمنيًا
├── functions/                     # Edge Functions (Deno)
│   ├── post-accounting-entry/
│   ├── run-bank-transfer/
│   ├── detect-duplicate-invoice/
│   ├── import-bank-statement/
│   ├── sign-cloudinary-upload/    # تُصدر توقيعًا مؤقّتًا للرفع الآمن
│   └── delete-cloudinary-asset/   # حذف أصل من Cloudinary (يملك api_secret)
└── seed.sql
```

### 3.3 قواعد الاستيراد (يفرضها ESLint)

- `core/**` لا يستورد من `application`, `infrastructure`, `presentation`, ولا من `react`/`@supabase`.
- `application/**` لا يستورد من `infrastructure`, `presentation`, `react`, `@supabase`.
- `presentation/**` لا يستورد `@supabase/*` مطلقًا؛ يصل للبيانات عبر Use Cases المحقونة من الـ DI container.
- الـ Mappers هي المكان الوحيد الذي يعرف شكل صفوف قاعدة البيانات وشكل كيانات الدومين معًا.

### 3.4 نمط الـ Use Case

```ts
// application/shared/use-case.ts
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Result<Output, DomainError>>;
}
```

كل use-case: يستقبل DTO، يستدعي Ports، يطبّق قواعد الدومين، يعيد `Result`. لا يرمي استثناءات للتحكّم في التدفّق.

### 3.5 حقن التبعيات (DI)

Composition Root في `infrastructure/di/container.ts` يربط كل Port بتحقيقه، ويُمرَّر للـ React عبر Context (`DIProvider`). الـ Hooks تسحب الـ use-case من الـ container ولا تُنشئه بنفسها. هذا يجعل الاستبدال والاختبار سهلين (وفاءً بمطلب «سهل التعديل»).

### 3.6 تخزين الملفّات (Cloudinary عبر منفذ مجرّد)

كل رفع/عرض/حذف للملفّات يمرّ عبر منفذ مجرّد في `application/shared/ports`، وتحقيقه الوحيد `CloudinaryFileStorage` في `infrastructure/services`. الواجهة **لا تعرف** أن المزوّد هو Cloudinary — تتعامل مع الأنواع المجرّدة فقط، فيسهل تبديل المزوّد لاحقًا.

```ts
// application/shared/ports/file-storage.ts
export interface StoredFile {
  publicId: string;
  url: string;
} // ما يُحفظ في قاعدة البيانات
export interface UploadTicket {
  uploadUrl: string;
  params: Record<string, string>;
} // توقيع مؤقّت

export interface IFileStorage {
  // تُنفَّذ عبر Edge Function: تُصدر توقيعًا مؤقّتًا لرفع مباشر من المتصفّح
  createUploadTicket(folder: string): Promise<Result<UploadTicket, DomainError>>;
  // تحويل publicId إلى رابط عرض (مع تحويلات اختيارية: حجم/جودة)
  buildUrl(publicId: string, opts?: { width?: number; quality?: number }): string;
  // حذف عبر Edge Function (يتطلّب api_secret على الخادم)
  remove(publicId: string): Promise<Result<void, DomainError>>;
}
```

**تدفّق الرفع الآمن (signed upload):**

1. الواجهة تنادي use-case `RequestUploadTicket` ← ينادي `IFileStorage.createUploadTicket`.
2. التحقيق ينادي Edge Function `sign-cloudinary-upload` (تملك `CLOUDINARY_API_SECRET`) فتعيد `signature + timestamp + api_key + folder`.
3. الواجهة ترفع الملف **مباشرة** إلى `https://api.cloudinary.com/v1_1/<cloud_name>/auto/upload` بهذه المعاملات.
4. Cloudinary يعيد `{ public_id, secure_url }` → نمرّرها للـ use-case المعني (مثل `AttachInvoiceImage`) الذي يخزّن **`public_id` و`secure_url` فقط** في الصف المناسب.

قواعد ملزِمة: (أ) `CLOUDINARY_API_SECRET` **لا يظهر في المتصفّح إطلاقًا**؛ (ب) حذف الملفّات يمرّ عبر Edge Function لا من الواجهة؛ (ج) استخدم **مجلّدات Cloudinary** منظّمة حسب الوحدة والمشروع (مثال: `erp/{project_id}/invoices/…`، `erp/equipment/…`) لتسهيل الإدارة والصلاحيات؛ (د) للمستندات الحسّاسة (عقود، فواتير) استخدم أصولًا خاصّة (`type: authenticated`) وروابط موقّعة عند العرض بدل الروابط العامّة.

---

## 4. الاصطلاحات (Conventions)

- **التسمية:** ملفات المكوّنات `PascalCase.tsx`، الـ hooks `useX.ts`، الـ use-cases `VerbNoun.ts` (مثل `CreateMaterialRequest.ts`)، الجداول والأعمدة في Postgres `snake_case`.
- **TypeScript:** `strict: true`, ممنوع `any` (استخدم `unknown` + تضييق النوع)، ممنوع `enum` (استخدم union types أو `as const`).
- **التحقق:** كل مدخلات المستخدم عبر zod schema؛ اشتق النوع بـ `z.infer`.
- **الأخطاء:** استخدم `Result<T,E>` في `core`/`application`. في الحدود (Edge/Repos) حوّل الأخطاء إلى `DomainError`.
- **RTL والعربية:** `<html dir="rtl" lang="ar">`، كل النصوص من `i18n/ar.ts`، الأرقام والتواريخ عبر formatters موحّدة. المسافات المنطقية (`ms-`/`me-`) بدل `ml-`/`mr-`.
- **التعليقات:** بالعربية للشرح المفاهيمي، بالإنجليزية للتوثيق التقني القصير فوق الدوال العامة.
- **لا أرقام سحرية:** الثوابت (المدد الافتراضية، النسب، حدود العهدة) في جداول إعدادات قابلة للتعديل من الواجهة، لا مكتوبة في الكود (المواصفات تصرّ على قابلية تعديل كل رقم).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`...). كل ميزة على فرع مستقل.

---

## 5. الأمان والصلاحيات (RBAC + RLS)

### 5.1 النموذج

- `roles` (أدوار) و`permissions` (صلاحيات دقيقة مثل `material_request.create`, `manual_entry.post`, `custody.approve`).
- `role_permissions` و`user_roles`.
- `project_assignments` — يربط الموظف بالمشاريع المعتمد عليها. **مفتاح تطبيق قاعدة «لا توقيع على مشروع غير معتمد».**

### 5.2 التطبيق

- **RLS في Postgres** هو خط الدفاع الأساسي: كل جدول عملياتي عليه Policies تتحقق من (أ) أن للمستخدم الصلاحية، (ب) أن المشروع ضمن `project_assignments` الخاصة به.
- **الواجهة** تعرض/تخفي عبر `<PermissionGate permission="...">` و`ProtectedRoute` — لكنها **لا تُعتمد كأمان**، فقط UX.
- الحقول الحسّاسة (الكمية القصوى، الرصيد المتبقي، الأسعار للموقع، الأصناف لأفراد بعينهم) تُخفى على مستوى الـ view/RLS لا على مستوى CSS.

---

## 6. محرّك سير العمل (Workflow Engine) — الأهم

هذا المحرّك يخدم وحدة «المراسلات والتقييم» ويُعاد استخدامه لكل مستند قابل للاعتماد (مستخلص، عهدة، طلب احتياج، خطاب...).

### 6.1 المفاهيم

- **transaction:** أي معاملة تسير في النظام. لها `type` و`reference_document` (polymorphic عبر `entity_type` + `entity_id`).
- **workflow_definition / workflow_step:** تعريف المسار ومراحله لكل نوع معاملة.
- **transaction_step_instance:** مرحلة فعلية لمعاملة، بها: الموظف المسؤول، المدة المخصّصة، وقت الوصول، وقت الإنجاز، الحالة، الدرجة.

### 6.2 المتطلبات المترجمة (مرجع: قسم «المراسلات والتقييم»)

- **المدد:** لكل موظف/نوع معاملة مدة تُدخَل مرة واحدة (`step_duration_settings`). خيار: المدة لكل مرات التكرار أم لمرة واحدة (`duration_scope: 'all_occurrences' | 'single'`). [البنود 1،2،6]
- **مرور على «مدير البرنامج»:** إجباري لتحديد المدة أول مرة، مع خيار إلغاء المهمة، وصلاحية تعديل المدة حتى بعد انتهائها + تقرير بالمدد المعدّلة (قبل/بعد/الموظف). [3،4،5]
- **العدّاد التنازلي:** يظهر في صندوق الوارد وعند فتح المعاملة، ويُحسب **داخل مواعيد العمل فقط** (يتوقّف خارج الدوام وأيام الإجازات ويكمل اليوم التالي). عدّاد إضافي «وصلت منذ...». [3،7]
- **مواعيد العمل:** إعداد عام لكل الموظفين + استثناءات فردية + تعديل بأثر رجعي حتى بعد انتهاء الشهر. [8]
- **قفل المعاملة:** إعادتها لطالبها ليعطي «تمام الإنجاز» ضمن مدة وعدّاد، فيتوقّف العدّاد وتظهر كمنجَزة. [9]
- **الخطابات الآلية:** يحرّرها النظام تلقائيًا بصيغة يحددها صاحب الصلاحية، بمواعيد/تكرار، خطاب رسمي في الوارد (لا إشعار)، له مدة، ويظهر في تقارير المتأخّر، ويُقفل عند مدير البرنامج أو مفوّض مؤقّت. [10]
- **التقييم:** درجة حسب زمن الإنجاز (٪ قابلة للتعديل): في الموعد 50٪، نصف المدة 75٪، ربع المدة 100٪، ضعف المدة 25٪، أكثر من الضعف 10٪. + درجات على السلوك والكفاءة وبنود قابلة للإضافة. أوزان مختلفة حسب الفئة (إداري 70٪/مهندس 20٪). تقييم من كل من تولّى الإشراف. استثناء موظفين. متوسطات فردية/للشركة، ترتيب، تقارير 3/6/12 شهرًا. [11–18]
- **العرض بالألوان في صندوق الوارد:** أخضر=منجَزة، أزرق=مرّ نصف المدة، أصفر=مرّ 75٪، أحمر=انتهت المدة. الترتيب حسب أولوية الوصول. [25]
- **التوزيع الآلي:** توجيه المعاملات آليًا حسب خطة يضعها المدير (مثال: كل العهد لموظف س) بدل تجميعها على المدير. [23]
- **الأصول والأرشيف:** أي معاملة تمرّ على موظف الأرشيف لاستلام الأصل، أيقونة «تم استلام الأصل» + تقرير بما لم تُستلم أصوله. [22]
- **البحث والخصوصية:** البحث عن معاملة يظهرها بلا تفاصيل لغير الموقّعين، والتفاصيل للموقّعين فقط؛ ملاحظات المدير: خيار إظهارها لموظف بعينه أو لكل من له توقيع. [19]
- **الترقيم الآلي، تصنيف الموظفين (إداري/مهندس/مشرف) وحجب فئة عن مراسلة فئة، تقارير التردّد على نفس القسم.** [20،21،24]

### 6.3 التحقيق التقني

- انتقالات الحالة والعدّادات المعتمدة على وقت العمل تُحسب في **Postgres function** `calc_step_remaining_time(step_id, now)` تأخذ في الحسبان `work_schedules` و`holidays`.
- الخطابات الآلية عبر **Supabase Scheduled Edge Function** (cron) تقرأ `auto_letter_rules` وتنشئ `transactions`.
- التقييم عبر view/materialized view `employee_evaluation_summary` + دوال تجميع.

---

## 7. نموذج البيانات (Database Schema)

> هذا مخطط أساسي يغطّي العمود الفقري. أنشئ كل جدول عبر migration منفصل. أضِف الحقول التفصيلية لكل وحدة عند تنفيذ مرحلتها. كل الجداول العملياتية بها `id uuid pk`, `created_at`, `updated_at`, `created_by`, وRLS مفعّل.

> **اصطلاح الوسائط:** لا نخزّن ملفّات في قاعدة البيانات ولا في Supabase Storage. أي عمود يحمل ملفًّا/صورة يخزّن مرجع **Cloudinary** فقط: عنصر مفرد كـ `jsonb {public_id, url}` (أو عمودَي `*_public_id text` و`*_url text`)، وعناصر متعدّدة كـ `jsonb [{public_id, url}]`. الرفع والحذف عبر تدفّق التوقيع الآمن في القسم 3.6.

### 7.1 مشترك (Shared / Core)

```sql
-- users مرتبط بـ auth.users
profiles(id uuid pk = auth.users.id, code text unique, full_name text,
         employee_type text, -- 'admin' | 'engineer' | 'supervisor'
         is_active bool, base_salary numeric)
roles(id, name, description)
permissions(id, key text unique, description)   -- e.g. 'material_request.create'
role_permissions(role_id, permission_id)
user_roles(user_id, role_id)

projects(id, code text unique, name, owner_entity text, contract_value numeric,
         received_at date, manager_id uuid, extracts_officer_id uuid, status text)
project_assignments(project_id, user_id, can_sign bool)  -- قاعدة الاعتماد

departments(id, name)
work_schedules(id, scope text, user_id null, day_of_week int, start_time time, end_time time)
holidays(id, date, description, scope)
settings(key text pk, value jsonb)  -- كل الأرقام القابلة للتعديل

-- المحاسبة الأساسية (تُملأ آليًا)
accounts(id, code, name, type)                 -- شجرة الحسابات
journal_entries(id, entry_no serial, date, description, source_type, source_id,
                is_manual bool default false, posted_by, project_id)
journal_lines(id, entry_id, account_id, debit numeric, credit numeric,
              party_type text, party_id uuid, item_id uuid null, boq_item_id uuid null)
audit_log(id, actor_id, action, entity_type, entity_id, diff jsonb, at)
```

### 7.2 الأصناف والبنود (تُستخدم عبر كل الوحدات)

```sql
items(id, code text unique, name, unit, category, searchable tsvector)  -- بحث بأي كلمة
boq_items(id, code text unique, name)                 -- البنود
item_boq_map(boq_item_id, item_id)                    -- تكوين البند من أصناف
saved_item_lists(id, owner_id, name)                  -- قوائم افتراضية (مخازن)
saved_item_list_lines(list_id, item_id)
```

### 7.3 المشتريات (Procurement)

```sql
suppliers(id, code text unique, name, contact jsonb)
supplier_bank_accounts(id, supplier_id, bank_name, account_no, iban)
site_stock(id, project_id, item_id, quantity, recorded_by)   -- المتوفر بالموقع

material_requests(id, no serial, project_id, status, created_by, merged_group_id null)
material_request_lines(id, request_id, item_id, boq_item_id null,
                       requested_qty, max_qty, prev_requested_qty, remaining_balance)
-- max_qty و remaining_balance مخفيّان عبر RLS عن غير المصرّح لهم

transfer_notes(id, no serial, from_project_id, to_project_id, status)  -- سند نقل أصناف
transfer_note_lines(id, note_id, item_id, qty, unit_cost)

purchase_requests(id, no serial, source_request_id, status)  -- طلب شراء = احتياج - المتوفر
purchase_request_lines(id, pr_id, item_id, qty)

supplier_quotes(id, pr_id, supplier_id)               -- تسعير
supplier_quote_lines(id, quote_id, item_id, unit_price)
-- المقارنة view: price_comparison(pr_id, item_id, supplier_id, unit_price)

supply_orders(id, no serial, pr_id, supplier_id, total, vat_amount, status) -- طلب توريد
supply_order_lines(id, so_id, item_id, qty, unit_price)

receipt_requests(id, no serial, supply_order_id, project_id, status) -- طلب استلام أصناف
receipt_request_lines(id, rr_id, item_id, qty)
```

قواعد المشتريات المترجمة (مرجع «أولاً المشتريات»): المكتب الفني يدخل الأصناف بكمياتها القصوى [1]؛ طلب الاحتياج يحسب `prev + current` ثم `max - total = remaining` تلقائيًا [2]؛ المشتريات لا تدخل بيانات يدويًا، فقط كود المورد وسعره في المقارنة [3]؛ دمج/فرز طلبات مشاريع متعددة مع بقاء التكلفة على كل مشروع [7]؛ VAT في بند منفصل قبل السداد [12]؛ لكل مستند لاحق: صفر إدخال يدوي.

### 7.4 التحويلات البنكية (Bank Transfers) — مشترك بين المشتريات والحسابات

```sql
payment_requests(id, source_type, source_id, party_type, party_id,
                 supplier_bank_account_id null, amount, status,
                 bank_fee_company numeric, bank_fee_client numeric)
payment_batches(id, kind text, -- 'grouped' | 'deferred' | 'cheque' | 'single'
                status, total)
payment_batch_items(batch_id, payment_request_id)
cheques(id, payment_request_id, cheque_no, signed_at)  -- تعبئة البيانات = أوراق دفع آليًا
```

عند ضغط «تم التحويل» → Edge Function `post-accounting-entry` تسجّل قيد الصرف + ذمم المورد آليًا [المشتريات 4]. تصدير الحوالة المجمّعة/المؤجلة يظهر رقم الحساب والبنك تلقائيًا [10].

### 7.5 المراسلات وسير العمل (Correspondence & Workflow)

```sql
workflow_definitions(id, transaction_type, name)
workflow_steps(id, definition_id, order_no, role_id null, department_id null)
transactions(id, no serial, type, entity_type, entity_id, project_id,
             current_step_id, status, requested_by, is_closed bool)
transaction_step_instances(id, transaction_id, step_id, assignee_id,
             allocated_minutes int, arrived_at, completed_at,
             status text, -- 'pending'|'in_progress'|'done'|'overdue'
             score numeric)
step_duration_settings(id, transaction_type, role_id null, user_id null,
             minutes int, duration_scope text)
duration_change_log(id, step_instance_id, old_minutes, new_minutes, changed_by, at)
auto_letter_rules(id, subject, body_template, schedule_cron, repeat bool,
             recipients uuid[], created_by)
evaluation_criteria(id, name, weight numeric, applies_to text)  -- سلوك/كفاءة/إنجاز
evaluation_scores(id, user_id, criteria_id, period, score, rated_by)
archive_receipts(id, transaction_id, received bool, received_at, has_original bool)
```

### 7.6 المخازن (Warehouse)

```sql
facilities(id, project_id, group_name, district, name, weight numeric) -- تجمّع>حي>منشأة
mandoub_stock(id, user_id, item_id, quantity)     -- المندوب كمخزن فرعي
facility_consumption(id, facility_id, item_id, qty, supervisor_id, at,
                     photos jsonb)                    -- Cloudinary: [{public_id, url}]
equipment(id, code text unique, name, current_project_id, spec jsonb,
          photo jsonb)                                -- Cloudinary: {public_id, url}
equipment_maintenance(id, equipment_id, type, part, notes, at)
equipment_movements(id, equipment_id, project_id, from_date, to_date, supervisor_id)
idle_equipment(id, equipment_id, available_from, available_to, note)
surplus_materials(id, project_id, item_id, qty)   -- مواد زائدة عن الحاجة
```

تقارير المقارنة (استهلاك المنشآت، الوزن النسبي للكشف عن الهدر [9]، مقارنة المشاريع/المشرفين، تراكمي 3/6/12 شهرًا) عبر views + recharts. إشعار فوري عند تنزيل الكميات [18،19].

### 7.7 الحسابات (Accounting) — المستخلصات والعهد

```sql
contractors(id, code text unique, name, bank jsonb)
extracts(id, no serial, contractor_id, project_id, boq_item_id, status,
         is_final bool, max_qty numeric)          -- مستخلص
extract_lines(id, extract_id, boq_item_id, unit_price, prev_qty, current_qty)
extract_workers(id, extract_id, worker_id, share, deduction)  -- استحقاق العمال آليًا

custodies(id, serial serial, holder_id, project_id, status, is_returned_box bool)
custody_invoices(id, custody_id, seq, supplier_seq_no, amount, item_id,
                 image_public_id text, image_url text, -- Cloudinary (صورة الفاتورة للمسح)
                 is_duplicate bool, is_returned bool)  -- كشف تكرار الفواتير
advance_payments(id, no serial, contractor_id, project_id, boq_item_id, amount, status)
guarantees(id, project_id, type, amount, expires_at)  -- تقارير انتهاء الضمانات
```

قواعد: اعتماد المستخلص/العهدة/الدفعة ⇒ قيد استحقاق آلي [الحسابات 19،22،23،33]؛ التحويل ⇒ قيد صرف آلي [21]؛ ترقيم المستخلص تلقائي 1..ختامي واستدعاء الكميات السابقة تلقائيًا [18]؛ كشف تكرار الفاتورة (صورة الفاتورة مخزّنة في Cloudinary وتُقرأ منها Edge Function `detect-duplicate-invoice`) بالمسح الضوئي وبمطابقة (الرقم+القيمة) وإبلاغ صاحب الصلاحية لا المُدخِل [29]؛ الفاتورة المرتجعة في عهدة حمراء مخصّصة [30]؛ عند إعداد مستخلص/عهدة يُعرض للمهندس المشاريع المعتمدة فقط [20،34].

### 7.8 شؤون الموظفين (HR)

```sql
employees(id = profiles.id, card_no, professions text[], salary_type text) -- راتب/يومية/إنتاج
attendance(id, project_id, worker_id, date, status text,  -- present|excused|absent|sick
           registered_by, is_temp bool)
labor_pool(id, worker_id, available_from, available_to, status text) -- شاغرة/منتدبة/بها مشكلة
loans(id, worker_id, amount, status)             -- سلف عبر الخدمة الذاتية
salary_changes(id, worker_id, old, new, approved_by)
worker_recommendations(id, worker_id, note, by)  -- HR فقط
production_ratings(id, worker_id, period, income, score)
```

قواعد: تسجيل يومية باقتراح أسماء الأمس مع «صح» وإزالة الغائب فقط [2]؛ بحث بالاسم الشاذ/الكود/البطاقة [2]؛ الغياب بإذن يوم، بدون إذن يومان، المرضى نصف يوم (كلها قابلة للتعديل) [3]؛ منع تسجيل نفس العامل في مشروعين بنفس اليوم [16]؛ منع التسجيل بعد 12 ظهرًا إلا بصلاحية [17]؛ صفحات: العمالة الشاغرة/المنتدبة/التي بها مشاكل [4،5،6]؛ خدمة ذاتية للعامل [7]؛ تقييم معدّل الإنتاج حسب الدخل [10] وبنود السلوك/الانضباط/الجودة/الفنيات [11].

---

## 8. الأتمتة المحاسبية (Auto-Posting) — سياسة موحّدة

كل حدث اعتماد/تحويل يُطلق قيدًا. النمط الموحّد:

1. تغيير حالة المستند (`status → 'approved' | 'transferred'`) عبر use-case.
2. الـ use-case يستدعي Edge Function `post-accounting-entry` بـ `{ source_type, source_id }`.
3. الدالة تقرأ المستند وأكواده (المورد/المقاول/المشروع/البند/الصنف)، وتبني `journal_entries` + `journal_lines` بلا أي إدخال بشري، ضمن معاملة Postgres واحدة (atomic).
4. القيد اليدوي ممنوع افتراضيًا؛ يُفتح بصلاحية `manual_entry.post` القابلة للفتح/الغلق، مع تقرير بالقيود اليدوية وبتلك التي نقلت مبالغ من الذمم للمصروف [الحسابات 17].

جدول ربط الأحداث بالقيود (نفّذه كـ mapping في الدالة):

| الحدث | مدين (Debit) | دائن (Credit) |
| --------------------------- | ---------------------- | ---------------------- | --------------------------------- |
| اعتماد عهدة | مصروف/مخزون المشروع | ذمم صاحب العهدة/المورد |
| تحويل مبلغ (مشتريات/مستخلص) | ذمم المورد/المقاول | البنك |
| اعتماد مستخلص | تكلفة البند/المشروع | ذمم المقاول |
| نقل مواد بين مواقع | مخزون الموقع المستقبِل | مخزون الموقع المُرسِل | (بثمن المواد آليًا [المشتريات 9]) |
| صرف سلفة | ذمم العامل | البنك |

---

## 9. نظام التصميم (Design System) — RTL عربي

- `tailwind.config.ts`: ألوان دلالية (`brand`, `surface`, `border`, حالات `success/info/warning/danger` لألوان صندوق الوارد الأربعة)، مقياس مسافات، خط عربي (`Tajawal`/`Cairo`) وخط mono للأكواد.
- مكوّنات `presentation/shared/ui`: `Button, IconButton, Input, Select, Combobox(بحث فوري), DataTable, Modal, Drawer, Tabs, Badge, StatusPill, Toast, Card, FormField, DateField, MoneyField, Timeline, CountdownBadge, PermissionGate, EmptyState, ConfirmDialog`.
- `CountdownBadge` و`StatusPill` يعكسان منطق ألوان سير العمل مباشرة.
- إمكانية الوصول: تركيز لوحة مفاتيح ظاهر، تباين كافٍ، `prefers-reduced-motion`.

---

## 10. خارطة الطريق (Delivery Roadmap)

نفّذ بالترتيب. لا تبدأ مرحلة قبل اكتمال معايير قبول سابقتها.

### Phase 0 — التأسيس (Foundation)

- [ ] تهيئة Vite + React + TS(strict) + Tailwind + ESLint/Prettier + قاعدة حدود الطبقات.
- [ ] إعداد مشروع Supabase، `client.ts`, `.env`, أنواع `database.types.ts`.
- [ ] إعداد Cloudinary: منفذ `IFileStorage` + تحقيق `CloudinaryFileStorage` + Edge Function `sign-cloudinary-upload` + مكوّن رفع مشترك `<FileUpload>` في نظام التصميم (يُختبر برفع صورة واحدة).
- [ ] القوالب المعمارية: `Result`, `UseCase`, `DIProvider`, `container.ts` مع تحقيق وهمي (in-memory) لتجربة الربط.
- [ ] نظام التصميم الأساسي + `AppShell` RTL + i18n `ar.ts`.
- **قبول:** صفحة تجريبية تعرض بيانات من use-case محقون عبر DI، RTL يعمل، الـ lint يمنع استيراد Supabase من presentation.

### Phase 1 — الهوية والصلاحيات والمشاريع (Auth, RBAC, Projects)

- [ ] جداول: profiles, roles, permissions, user_roles, role_permissions, projects, project_assignments, settings.
- [ ] RLS + دوال `has_permission()`, `is_assigned_to_project()`.
- [ ] تسجيل الدخول، `ProtectedRoute`, `PermissionGate`, شاشة إدارة المستخدمين والأدوار والمشاريع.
- **قبول:** مستخدم يرى فقط مشاريعه المعتمدة، والصلاحيات تخفي الشاشات.

### Phase 2 — الأصناف والبنود والمحاسبة الأساسية (Items, BOQ, Accounting core)

- [ ] items(بحث tsvector), boq_items, item_boq_map, saved_item_lists.
- [ ] accounts, journal_entries, journal_lines + Edge Function `post-accounting-entry` (هيكل + اختبار).
- **قبول:** بحث فوري بأي كلمة في الأصناف، وقيد آلي يُنشأ من حدث تجريبي.

### Phase 3 — المشتريات (Procurement) الكاملة

- [ ] كل جداول 7.3 + التحويلات 7.4، محرّك المقارنة، VAT، الدمج/الفرز، السندات المتسلسلة.
- [ ] ربط الاعتماد/التحويل بالقيود الآلية.
- **قبول:** رحلة كاملة: احتياج ← شراء ← تسعير ← مقارنة ← توريد ← تحويل(قيد آلي) ← استلام(قيد آلي)، بلا إدخال يدوي مكرّر.

### Phase 4 — محرّك سير العمل والمراسلات والتقييم

- [ ] جداول 7.5 + دوال العدّاد ضمن أوقات العمل + الألوان + التوزيع الآلي + الخطابات المجدولة + التقييم والتقارير.
- **قبول:** معاملة تمرّ بمراحلها بعدّاد صحيح يحترم الدوام، وتُحتسب درجتها، وتظهر التقارير والترتيب.

### Phase 5 — المخازن (Warehouse)

- [ ] المندوب كمخزن فرعي، هرم المنشآت، الاستهلاك مع الصور، المعدات وملفاتها وحركتها، الشاغرة، المواد الزائدة، تقارير المقارنة بالوزن.
- **قبول:** تنزيل كميات ينقص عهدة المندوب ويطلق إشعارًا، وتقرير الهدر بالوزن يعمل.

### Phase 6 — الحسابات المتقدّمة (المستخلصات والعهد)

- [ ] المقاولون، المستخلصات (ترقيم آلي، كميات سابقة، حد أقصى، استحقاق العمال)، العهد، كشف تكرار الفواتير (Edge Function)، السلف، الضمانات، تقارير المديونية والخطابات الرسمية الآلية.
- **قبول:** اعتماد مستخلص ⇒ قيد استحقاق آلي، وكشف تكرار فاتورة يبلّغ صاحب الصلاحية.

### Phase 7 — شؤون الموظفين (HR) والخدمة الذاتية

- [ ] الموظفون، اليوميات بالطريقة المقترحة، قواعد الغياب، صفحات العمالة، التقييمات، الخدمة الذاتية، ترحيل كشف البنك للرواتب (Edge Function `import-bank-statement`).
- **قبول:** تسجيل يومية باقتراح الأمس، منع الازدواج بين المشاريع، وتقرير «كم يومية كلّفني المشروع».

### Phase 8 — الصقل (Hardening)

- [ ] تقارير شاملة، أذونات دقيقة، اختبارات e2e لأهم الرحلات، أداء، نسخة اختبارية من البيانات [الحسابات 1]، توثيق المستخدم.

---

## 11. تعليمات للـ Agent أثناء التنفيذ

1. **لا تتجاوز نطاق المرحلة الحالية.** إن ظهر مطلب من مرحلة لاحقة سجّله كـ TODO ولا تنفّذه الآن.
2. **كل ميزة = migration + entity + port + use-case + repository adapter + mapper + hook + UI + test.** لا تختصر الطبقات.
3. **راجع «القاعدة الذهبية» قبل أي شاشة إدخال:** إن كان البيان مُدخَلًا سابقًا، استدعِه ولا تطلبه ثانية.
4. **أي رقم/نسبة/مدة ⇒ في جدول `settings` قابل للتعديل**، لا ثابتًا في الكود.
5. **أي اعتماد/تحويل ⇒ قيد آلي** عبر السياسة الموحّدة في القسم 8.
6. **RLS أولًا:** لا تكتب شاشة قبل تأمين جدولها بـ Policies تحترم الصلاحية والمشروع المعتمد.
7. **اسأل عند الغموض:** بعض المتطلبات تحتاج قرارات عمل (صيغ الخطابات، شجرة الحسابات الدقيقة، معادلة «جودة الاستثمار» [الحسابات 8]). اترك واجهة قابلة للتهيئة بدل افتراض قيم نهائية.

## 12. متغيّرات البيئة

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
# Cloudinary — العامّة فقط تُعرَض للمتصفّح:
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_API_KEY=
# للـ Edge Functions (سرّية، لا تُعرَض للمتصفّح إطلاقًا):
SUPABASE_SERVICE_ROLE_KEY=
CLOUDINARY_API_SECRET=
```

## 13. أوامر التشغيل

```bash
npm install
npm run dev            # تشغيل الواجهة
supabase start         # Postgres محلي
supabase db push       # تطبيق الـ migrations
# ضبط الأسرار للـ Edge Functions (Cloudinary):
supabase secrets set CLOUDINARY_API_SECRET=... CLOUDINARY_API_KEY=... CLOUDINARY_CLOUD_NAME=...
supabase functions serve
npm run test           # Vitest
npm run lint
```
