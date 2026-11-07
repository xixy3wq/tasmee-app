---
name: open-design-systems
description: The 152 design systems bundled with Open Design (nexu-io/open-design) as DESIGN.md files, covering style families (minimal, editorial, elegant, warm-editorial, glassmorphism, neobrutalism, material, shadcn, dashboard, luxury, retro, an RTL "urdu" system…) as well as brands. Use when choosing an overall visual direction or style family for a page, image, slide or redesign, or when the brief names a style rather than a brand.
---

# Open Design: أنظمة التصميم

Open Design بديل مفتوح المصدر لـ Claude Design، لكنه تطبيق كامل يعمل على جهاز المستخدم (برنامج وخادم محلي)، فلا يمكن تشغيله في جلسات السحابة.
لذلك نقلنا منه الجزء الذي يمكن استخدامه في أي مكان: مكتبة أنظمة التصميم، كل نظام في `systems/<الاسم>/DESIGN.md` (النسخة الإنجليزية فقط).
المصدر: https://github.com/nexu-io/open-design (رخصة Apache-2.0 في `LICENSE`، وبعض الأنظمة مأخوذة أصلًا من awesome-design-md وbergside/awesome-design-skills).

## الاستخدام

1. حدّد نوع الواجهة أولًا: لوحة معلّم أو طالب (تشغيلية)، صفحة تعريفية (إقناع)، دليل (قراءة).
2. اقرأ نظامًا أو اثنين قريبين من المطلوب، وخذ منهما القواعد: التدرج، المسافات، الكثافة، الحركة، حالات الأزرار.
3. هوية المشروع (`CLAUDE.md`) تتقدّم على أي نظام هنا: الكحلي والفيروزي للبنين، والبرقوقي والوردي للبنات، وخطوط IBM Plex Sans Arabic وAmiri.

## أنظمة قريبة من طبيعة المشروع

- هادئة ومناسبة للتعليم: `minimal`, `clean`, `friendly`, `spacious`, `simple`, `refined`, `professional`.
- قراءة وتحرير: `editorial`, `warm-editorial`, `publication`, `paper`, `kami`.
- لوحات وأرقام: `dashboard`, `shadcn`, `material`, `enterprise`.
- اتجاه من اليمين لليسار وخط نسخ/نستعليق: `urdu` (مفيد كمرجع لثنائية اللغة وRTL).

## كل الأنظمة

```bash
ls .claude/skills/open-design-systems/systems
```

العلامات التجارية الموجودة هنا موجودة أيضًا (بصيغة أطول غالبًا) في مهارة `awesome-design-md`.
