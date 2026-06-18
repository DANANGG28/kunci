# PROPOSAL: PERFECT10 Internship Challenge Implementations

## 1. Ringkasan Eksekutif

Platform KUNCI adalah mesin *cold outreach* B2B berbasis pipeline yang sudah berjalan di atas arsitektur production-grade: multi-stage pipeline dengan BullMQ, auto-reply chat berbasis AI intent classification, follow-up scheduling, dan container hardening. Proposal ini menguraikan **penyempurnaan dan penambahan** di atas fondasi yang sudah ada — bukan penggantian business logic — berdasarkan tantangan internship PERFECT10.

Fokus implementasi: segmentasi lead end-to-end, validasi input sesuai OWASP, eliminasi magic string, runtime type safety di repository boundary, dan persiapan fondasi multi-tenant untuk production scale.

## 2. Arsitektur Existing

### 2.1 Pipeline Outbound (Cold Outreach)

Pipeline utama berjalan di `run-outbound-pipeline.ts` dengan 7 tahapan yang di-track per langkah:

| Tahap | ID | Model AI | Layanan Eksternal |
|-------|-----|----------|-------------------|
| Capture | `capture` | — | PostgreSQL |
| Enrichment | `enrich` | `openai/o3-mini` | Deepcrawl + OpenRouter |
| Scrape Website | `scrape` | — | Deepcrawl |
| Analisis Website | `analyze_website` | `openai/o3-mini` | OpenRouter |
| Company Profile | `build_profile` | `openai/gpt-4.1-mini` | OpenRouter |
| Analisis Perilaku | `analyze_behavior` | `openai/gpt-4o` | OpenRouter |
| Kirim Email | `send_email` | `openai/gpt-4o-mini` | OpenRouter + Resend |

**Dual-path execution berdasarkan segmen:**
- **Talent**: Melewati enrichment dan scraping. Konteks dibangun dari metadata lead (`buildTalentResearchContext`), tidak perlu company website.
- **Enterprise / Agency**: Full enrichment → scraping → multi-step AI analysis → generate sequence → kirim email pertama.

Error handling per-tahap dengan *graceful degradation*: kegagalan enrichment non-fatal (pipeline lanjut), kegagalan scraping/behavior/send bersifat fatal (lead ditandai `research_failed`, Slack notifikasi dikirim).

### 2.2 Deteksi Segmen Otomatis

`detectSegment()` di `detect-segment.ts` — rule-based classifier deterministik:

1. **Talent**: Domain email gratis (gmail, yahoo, hotmail) **atau** tidak ada company website
2. **Agency**: Domain recruitment platform (greenhouse.io, lever.co, workable.com, dll — 13 domain) **atau** kata kunci agency di `leadSource`
3. **Enterprise**: Email korporat + website tersedia (default fallback)

### 2.3 Infrastruktur Production

| Komponen | Teknologi | Status |
|----------|-----------|--------|
| Runtime | Node.js 22 Alpine, ESM | Production |
| HTTP Framework | Hono + oRPC | Production |
| Database | PostgreSQL 17, Drizzle ORM | Production |
| Queue | BullMQ + Redis 7 | Production |
| AI | OpenRouter (GPT-4o/o3-mini) | Production |
| Email | Resend API + Webhook | Production |
| Scraping | Deepcrawl | Production |
| Auth | Better Auth (session-based) | Production |
| Container | Multi-stage Docker, read-only FS, non-root user, dropped capabilities | Production |
| Observability | Pino structured logging, PipelineTracker, Slack notifikasi | Production |

### 2.4 Yang Sudah Production-Grade

- **Graceful shutdown**: SIGINT/SIGTERM handler, drain BullMQ worker, tutup HTTP server
- **Health check**: `/healthz` (liveness) + `/ready` (readiness, cek Redis ping)
- **Environment validation**: Zod schema validasi semua env vars saat startup
- **Retry queue**: 3 attempt, exponential backoff 30s, rate limiting (default 10/detik)
- **Auto-reply chat**: Intent classification (6 intent), turn cap (max 6), jittered delay (3-15 menit), re-verifikasi sebelum kirim
- **ASEAN locale inference**: 10 negara, deterministik, offline, TLD-based
- **Email threading**: `messageId` / `inReplyTo` / `previousRefs` tracking
- **Opt-out lifecycle**: Token-based unsubscribe, opt-out registry, reply-based detection
- **Settings service**: 50+ config key untuk model AI, prompt, temperature, pipeline tuning, email styling — dapat diubah tanpa deploy

## 3. Implementasi Tambahan

Berikut adalah penyempurnaan yang diimplementasikan **di atas fondasi existing**, tanpa mengubah business logic pipeline yang sudah berjalan.

### 3.1 Segmentasi Lead End-to-End

**Masalah**: `LeadSegment` sudah didefinisikan (`"talent" | "agency" | "enterprise"`) tapi tidak muncul di frontend, tidak bisa diset oleh client, dan logika deteksi `agency` tidak ada.

**Solusi**:

| Layer | File | Perubahan |
|-------|------|-----------|
| Domain | `detect-segment.ts` | Tambah deteksi agency: 13 domain recruitment + kata kunci `leadSource` |
| Application | `enrich-input.ts` | Fungsi baru: SSOT enrichment — `input.segment ?? detectSegment(input)` |
| Application | `capture-lead.ts` | Pakai `enrichLeadInput` sebagai pengganti inline enrichment |
| Application | `bulk-capture-lead.ts` | Pakai `enrichLeadInput` yang sama (DRY) |
| Presentation | `routers/lead.ts` | `superRefine`: validasi pakai `data.segment ?? detectSegment(data)` |
| Frontend | `leads/-columns.tsx` | Kolom Segment dengan color-coded Badge |
| Frontend | `-use-capture.ts` | Field segment di capture form |
| Frontend | `-use-bulk-capture.ts` | Field segment di CSV header mapping |

**Prinsip**: Client set segment sebagai hint, server compute sebagai fallback. SSOT di `enrichLeadInput`.

### 3.2 Validasi Input OWASP

**Masalah**: Router Zod schema tidak membatasi panjang string, tidak memvalidasi URL scheme.

**Solusi** di `routers/lead.ts`:

| Field | Batasan | Aturan Tambahan |
|-------|---------|-----------------|
| `fullName` | `.max(200)` | — |
| `email` | `.max(254)` | Format email |
| `companyName` | `.max(200)` | — |
| `companyWebsite` | `.max(2048)` | Allowlist scheme: http/https only |
| `painPoints` | `.max(5000)` | — |
| `leadSource` | `.max(200)` | — |
| `linkedinUrl` | `.max(2048)` | Allowlist scheme: http/https only |
| List `limit` | `.max(100)` | — |
| List `status` | `.max(50)` | — |

### 3.3 Runtime Type Guards (Repository Boundary)

**Masalah**: `mapRowToLead()` di `lead-repository.ts` menggunakan blind type assertion `as` tanpa validasi runtime. Database row adalah external boundary — data corrupt bisa lolos ke domain.

**Sebelum**:
```typescript
segment: row.segment as Lead["segment"],
stage: row.stage as Lead["stage"],
replyStatus: row.replyStatus as Lead["replyStatus"],
completedReason: (row.completedReason ?? null) as Lead["completedReason"],
```

**Sesudah**: Validasi dengan type guard + throw Error jika invalid:
```typescript
if (!isLeadSegment(segment)) throw new Error(...)
if (!isLeadStage(stage)) throw new Error(...)
if (!isReplyStatus(replyStatus)) throw new Error(...)
if (completedReason !== null && !isCompletedReason(completedReason)) throw new Error(...)
```

Type guard `isReplyStatus` dan `isCompletedReason` sudah ada. `isLeadSegment` dan `isLeadStage` ditambahkan dengan refactor `const` array (pola yang sama).

### 3.4 Eliminasi Magic String

**Masalah**: `generators.ts:41` — `rawPrompt.replace(/\b3-email\b/i, ...)` fragile string replacement. `send-email.ts` — hardcoded `as 1 | 2 | 3` dan `nextStage > 3` (asumsi sequence selalu 3 email), padahal `SETTING_KEYS.PIPELINE_EMAIL_SEQUENCE_COUNT` sudah ada.

**Solusi**:
- Prompt template (`prompts/index.ts`): hapus `"3-email"` dari `SEQUENCE_GENERATOR_PROMPT`. Sequence count di-inject via user message `SEQUENCE_COUNT: Generate exactly ${sequenceCount} emails`.
- `generators.ts`: hapus `.replace(/\b3-email\b/i, ...)` — tidak diperlukan lagi.
- `send-email.ts`: helper `getEmailSequenceCount(settings)` — baca dari settings, default 3. Runtime validation `emailNumber` di range `1..count` dengan `throw AppError(...)` jika out of range. `nextStage > emailCount` bukan hardcoded `> 3`.

### 3.5 Frontend Improvements

- Kolom Segment di leads table dengan Badge berwarna (talent=primary, agency=accent, enterprise=info)
- Field segment opsional di single capture form + bulk CSV import
- CSV template diperbarui dengan contoh data segment

## 4. Fondasi Production-Scale

Sistem existing sudah production-grade pada layer container dan infrastruktur, namun beberapa gap perlu ditutup untuk skala production sejati:

### 4.1 Yang Sudah Ada

- Container hardening (read-only FS, non-root user, dropped capabilities, resource limits)
- Graceful shutdown + health checks
- Zod environment validation dengan production guard
- Structured logging (Pino JSON)
- BullMQ retry dengan exponential backoff + rate limiting
- Slack notifikasi untuk pipeline failure

### 4.2 Yang Perlu Ditambahkan

| Gap | Dampak | Prioritas |
|-----|--------|-----------|
| **Multi-tenant scoping** | Tidak ada `workspaceId`/`tenantId` di entity domain. `LeadRepository.findByEmail` lookup global tanpa filter workspace. | Tinggi |
| **CI/CD pipeline** | Tidak ada GitHub Actions atau automated test/build/deploy. | Tinggi |
| **Rate limiting HTTP** | Endpoint publik (webhook, unsubscribe, oRPC) tanpa rate limit. Hanya BullMQ pipeline yang punya rate limit. | Menengah |
| **Redis persistensi** | `save ""` dan `appendonly no` — BullMQ jobs + cache hilang saat Redis restart. | Menengah |
| **In-memory semaphore OpenRouter** | Rate limit AI call tidak terbagi antar instance API. | Menengah |
| **Cron scheduler in-process** | `croner` jalan di setiap instance — duplicate follow-up jobs jika multi-instance. | Menengah |
| **Log aggregation** | Hanya Docker json-file driver. Tidak ada integrasi ELK/Loki/Datadog. | Rendah |
| **Metrics/APM** | Tidak ada Prometheus endpoint atau OpenTelemetry. | Rendah |

## 5. VISION: Dua Minggu Tambahan

### "Dengan dua minggu tambahan, saya akan memperkuat fondasi production-scale KUNCI tanpa mengubah business logic pipeline yang sudah berjalan."

### Week 1: Fondasi Multi-Tenant

**Tujuan**: Memungkinkan KUNCI melayani banyak klien secara bersamaan dengan isolasi data penuh.

1. **Domain**: Tambah `workspaceId` ke entity `Lead`, `EmailSequence`, `EmailMessage`, `OptOut`, `BehaviorAnalysis`
2. **Repository**: Filter query selalu include `workspaceId` — mencegah data leak antar tenant
3. **Middleware**: Ekstrak tenant dari request context (subdomain, header, atau JWT claim)
4. **Settings service**: Scoping per-workspace — setiap tenant punya konfigurasi pipeline, AI model, dan branding sendiri
5. **Migration**: Tambah kolom `workspace_id` dengan default workspace untuk existing data
6. **Test**: Verifikasi isolasi data — tenant A tidak bisa akses lead tenant B

**Rationale**: User mengoperasikan multiple apps & services. Multi-tenant adalah fondasi, bukan fitur yang "dipangkas". Tanpa ini, scaling ke multiple klien mustahil.

### Week 2: CI/CD + Segment Analytics Dashboard

**Tujuan**: Otomatisasi deployment dan visibilitas performa per segmen.

1. **CI/CD Pipeline** (GitHub Actions):
   - `pnpm typecheck` + `pnpm lint` pada setiap PR
   - `pnpm test` pada setiap push ke main
   - Build Docker image + push ke registry pada tag release
   - Deploy otomatis ke staging environment

2. **Segment Analytics Dashboard**:
   - Endpoint API: reply rate, bounce rate, conversion rate per segmen
   - Frontend chart: tren mingguan per segmen di dashboard
   - Alert: Slack notifikasi jika reply rate segmen tertentu turun >20%

### Metrik Kesuksesan (End of Week 2)

| KPI | Target | Cara Ukur |
|-----|--------|-----------|
| Multi-tenant isolation | 0 data leak | Integration test: tenant A query tidak return data tenant B |
| CI/CD | 100% PR terverifikasi otomatis | Semua PR wajib lulus typecheck + lint + test |
| Segment dashboard | Data real-time per segmen | Verifikasi query terhadap pipeline_steps |
| Type safety | 0 runtime error | TypeScript strict + `isLeadStage`/`isLeadSegment` guards |
| Pipeline stability | 99% completion rate | Track via pipeline_steps completion |

### Yang Tidak Berubah

| Aspek | Alasan |
|-------|--------|
| Cold outreach tone pipeline | Business logic produksi, tidak diganti tanpa konfirmasi stakeholder |
| `detectSegment` rule-based classifier | Deterministis, terprediksi, tidak perlu ML |
| Pipeline stage structure | 7 tahap sudah proven, refactor hanya jika ada justifikasi jelas |
| Email threading model | Sudah production-grade |
| Auto-reply chat system | Intent classification + turn cap + jitter sudah solid |

**Prinsip**: Jika ada visi berbeda tentang arah produk (misalnya cold → warm inbound), **konfirmasi dulu ke stakeholder** sebelum implementasi. Jangan asumsikan perubahan business logic.

## 6. Risiko Teknis

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Migration multi-tenant dengan existing data | Downtime / data inconsistency | Migration bertahap dengan default workspace, backfill script terverifikasi |
| Rate limit eksternal (OpenRouter, Resend, Deepcrawl) | Pipeline gagal | Retry dengan exponential backoff sudah ada; circuit breaker perlu ditambahkan |
| Single point of failure Redis | Queue jobs hilang | Redis sentinel/replica untuk HA; snapshot periodik BullMQ state |
| UU PDP (Data Privacy) | Profiling tanpa consent | Consent checkbox di lead capture; privacy policy disclosure; audit log opt-out per segmen |

## 7. AI Usage & Transparency

### Kebijakan

AI (Claude Code, Cursor) digunakan sebagai **akselerator**, bukan pengganti pemahaman. Setiap baris kode yang dihasilkan AI diverifikasi terhadap codebase existing, di-test dengan TypeScript strict mode, dan di-review untuk memastikan tidak mengubah business logic.

### Breakdown Per Komponen

#### Segment Detection Enhancement (`detect-segment.ts`)

- **Kontribusi AI**: ~30% (suggest struktur `AGENCY_EMAIL_DOMAINS` Set dan `AGENCY_KEYWORDS` array)
- **Manual**: 70%
  - Menentukan 13 domain recruitment platform yang relevan untuk pasar ASEAN
  - Menentukan kata kunci agency (`"agency"`, `"recruitment"`, `"staffing"`, `"headhunter"`)
  - Memastikan urutan deteksi tidak berubah (talent → agency → enterprise)
  - Verifikasi: test 5+ skenario input

#### DRY Enrichment (`enrich-input.ts`)

- **Kontribusi AI**: ~20% (template struktur fungsi)
- **Manual**: 80%
  - Identifikasi duplikasi antara `capture-lead.ts` dan `bulk-capture-lead.ts`
  - Desain SSOT pattern: `input.segment ?? detectSegment(input)`
  - Refactor kedua use case untuk konsumsi fungsi yang sama
  - Verifikasi: 20/20 test lead tetap pass

#### Runtime Type Guards (`lead.ts` + `lead-repository.ts`)

- **Kontribusi AI**: ~10% (suggest pattern `const` array untuk type guard)
- **Manual**: 90%
  - Pattern `isReplyStatus` dan `isCompletedReason` sudah ada di codebase — tinggal extend
  - Refactor `LeadSegment` dan `LeadStage` ke `const` array
  - `isLeadStage` tambah cek `typeof n === "number"` karena stage adalah number literal
  - Ganti 4 blind `as` assertion di `mapRowToLead` dengan guard + throw Error

#### OWASP Input Validation (`routers/lead.ts`)

- **Kontribusi AI**: ~30% (suggest max length values dan URL scheme refine)
- **Manual**: 70%
  - Menentukan batas panjang yang realistis per field (RFC standar: 254 untuk email, 2048 untuk URL)
  - Memastikan `.superRefine()` tetap konsisten dengan `enrichLeadInput` (SSOT)
  - Verifikasi referensi OWASP cheat sheet sebelum finalisasi

#### Magic String Elimination (3 file)

- **Kontribusi AI**: ~25% (identifikasi lokasi hardcoded "3")
- **Manual**: 75%
  - Memahami interaksi prompt template → generators → send-email
  - Menentukan bahwa `SEQUENCE_COUNT` di user message adalah jalur yang benar
  - Refactor `send-email.ts`: helper `getEmailSequenceCount`, runtime validation
  - Verifikasi: 11/11 test email pass

#### Frontend Segment Display (4 file)

- **Kontribusi AI**: ~35% (suggest struktur Badge + kolom baru)
- **Manual**: 65%
  - Integrasi dengan design system `@kana-consultant/ui-kit`
  - Color mapping yang konsisten (talent=primary, agency=accent, enterprise=info)
  - CSV template update dengan contoh data realistis
  - Type safety end-to-end: type Lead di kolom tabel harus match dengan API response

### Verifikasi Keseluruhan

| Metode | Tools | Hasil |
|--------|-------|-------|
| TypeScript strict | `tsc --noEmit` | **Zero errors** pada setiap perubahan |
| Unit test | Vitest (68 test) | **66/68 pass** (2 gagal pre-existing webhook env issue) |
| Test spesifik lead | 20 test di `src/application/lead/` | **20/20 pass** |
| Test spesifik email | 11 test di `src/application/email/` | **11/11 pass** |
| Linting | Biome | Lolos tanpa error |

### Confidence Level

| Komponen | Confidence | Catatan |
|-----------|-----------|---------|
| Segment detection | 95% | Rule-based deterministik, terverifikasi manual |
| Runtime type guards | 95% | Pattern sudah proven di codebase |
| OWASP validation | 90% | Batasan sesuai standar, belum di-load test |
| Magic string elimination | 95% | `SEQUENCE_COUNT` dynamic, runtime validation |
| Frontend segment display | 90% | Type-safe end-to-end, belum E2E test |

## 8. Lessons Learned

1. **Konfirmasi sebelum mengubah business logic.** Pipeline cold outreach tidak boleh diganti menjadi warm inbound tanpa persetujuan stakeholder, terlepas dari seberapa "baik" visi tersebut. Engineering humility: kita membangun di atas fondasi yang sudah ada, bukan menulis ulang.

2. **Production-scale bukan MVP.** Multi-tenant adalah fondasi, bukan fitur yang "dipangkas". User mengoperasikan multiple apps & services. Setiap shortcut di awal akan menjadi tech debt yang harus dibayar dengan bunga tinggi.

3. **AI adalah tools, bukan otoritas.** Setiap suggest AI diverifikasi: cek terhadap codebase existing, test dengan TypeScript strict, review dampak terhadap business logic. AI sering menawarkan solusi yang "masuk akal" tapi salah secara konteks.

4. **DRY + SSOT mencegah divergensi.** `enrichLeadInput` sebagai shared function antara single dan bulk capture memastikan aturan bisnis konsisten. Tanpa ini, kedua jalur akan divergen seiring waktu.

5. **Type guard > type assertion.** Blind `as` di repository boundary adalah bom waktu. Runtime validation dengan guard memastikan data corrupt dari DB tidak menyebar ke domain layer.
