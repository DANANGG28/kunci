# KUNCI - Comprehensive Project Analysis

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Architecture](#project-architecture)
4. [Repository Structure](#repository-structure)
5. [Domain Model & Entities](#domain-model--entities)
6. [Application Layer & Use Cases](#application-layer--use-cases)
7. [Infrastructure Setup](#infrastructure-setup)
8. [Database Schema & Migrations](#database-schema--migrations)
9. [API & Presentation Layer](#api--presentation-layer)
10. [Frontend Application](#frontend-application)
11. [Authentication & Security](#authentication--security)
12. [Testing Strategy](#testing-strategy)
13. [Deployment & DevOps](#deployment--devops)
14. [Configuration & Environment](#configuration--environment)

---

## Project Overview

### What is KUNCI?

**KUNCI** is an AI-powered **Sales Development Representative (SDR)** platform that automates the complete outbound sales pipeline. It transforms raw lead data into qualified, engaged prospects through intelligent research, behavioral analysis, and personalized email sequencing.

### Business Purpose & Functionality

The platform handles the full sales automation workflow in an autonomous 4-stage pipeline:

1. **Capture** — Accept leads via manual entry or CSV bulk import
2. **Research** — Scrape company websites and enrich prospect data with LinkedIn integration
3. **Analyze** — Generate behavioral profiles using AI (pain points, journey stage, psychological triggers)
4. **Generate & Send** — Create personalized 3-email nurturing sequences with dynamic timing
5. **Engage** — Intelligently reply to inbound responses and continue conversations

**Key Features:**
- One-click lead capture triggers complete automated pipeline
- 8 specialized AI prompts for different stages (behavior analysis, web intelligence, sequence generation, reply handling)
- 3-email nurturing sequences with psychological triggers and subject line variations
- Auto-reply handling via webhook (Resend Inbound MX) or IMAP polling fallback
- Scheduled follow-ups with cron-based processing at optimal send times
- Real-time dashboard with lead pipeline visualization (Captured → Researched → Sequenced → Replied)
- End-to-end type safety via oRPC between frontend and backend
- Settings sandbox for prompt tuning and AI model configuration
- Unsubscribe management with one-click email suppression

---

## Technology Stack

### Core Framework & Runtime
- **Node.js 22** (Alpine Linux for production)
- **TypeScript 5.4+** — Strict mode, full type safety
- **pnpm** — Monorepo workspace management
- **Vite 6.0+** — Frontend build tool

### Backend
- **Hono 4.7+** — Lightweight HTTP framework (Node.js compatible)
- **oRPC (OpenRouter Procedure Call) 1.14+** — End-to-end type-safe RPC framework
- **Drizzle ORM 0.39+** — TypeScript-first SQL ORM
- **Better Auth 1.6.9** — Authentication & session management
- **BullMQ 5.76.7** — Job queue for pipeline processing
- **Croner 9.0.0** — Cron scheduler for follow-ups
- **ioredis 5.4.0** — Redis client for caching & job storage
- **Pino 9.6.0** — Structured logging

### Frontend
- **React 19** — UI framework
- **TanStack Router 1.0.0** — File-based routing
- **TanStack React Query 5.0.0** — Server state management
- **TanStack React Table 8.21.3** — Data table component
- **TanStack React Form 1.29.1** — Form state management
- **TailwindCSS 4.0** — Utility-first CSS framework
- **@kana-consultant/ui-kit** — Custom component library (private)
- **Lucide React 0.470.0** — Icon library

### Infrastructure & Integrations
- **PostgreSQL 17** — Primary relational database
- **Redis 7+** — Cache layer, job queue storage
- **OpenRouter API** — LLM inference (supports multiple models: Claude, Grok, GPT-4, etc.)
- **Resend 6.12.2** — Email delivery & inbound webhook support
- **Deepcrawl 0.1.0** — Website scraping/crawling service
- **IMAP (imapflow 1.3.3)** — Fallback email polling for replies
- **LinkedIn API** — Prospect enrichment (with crawling permission gate)
- **Mailparser 3.9.8** — Email parsing

### Development Tools
- **Biome 2.4.13** — Unified linter & formatter
- **Vitest 3.2.4** — Unit testing framework
- **MSW (Mock Service Worker) 2.0** — API mocking for tests
- **tsx 4.19.0** — TypeScript runner for scripts
- **tsup 8.0.0** — Bundler for backend distribution
- **drizzle-kit 0.30.0** — Schema migration generator

---

## Project Architecture

### Four-Layer Clean Architecture

KUNCI follows strict **Clean Architecture** principles with inbound-only dependency flow:

```
┌─────────────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                             │
│          (oRPC Routers, Webhooks, HTTP)                     │
├─────────────────────────────────────────────────────────────┤
│              APPLICATION LAYER                              │
│         (Use Cases, Orchestration, Domain Logic)            │
├─────────────────────────────────────────────────────────────┤
│              DOMAIN LAYER                                   │
│    (Entities, Value Objects, Port Interfaces)              │
├─────────────────────────────────────────────────────────────┤
│              INFRASTRUCTURE LAYER                           │
│   (DB, Cache, Email, AI, Scraper, Auth, Logging)          │
└─────────────────────────────────────────────────────────────┘
```

**Dependency Rules:**
- Presentation depends on Application & Domain only
- Application depends on Domain only
- Domain defines Ports (interfaces) — Infrastructure implements them
- **No infrastructure imports in domain or application layers**
- All external services accessed via Dependency Injection

### Architectural Principles

1. **Ports & Adapters Pattern** — Infrastructure interfaces defined in domain, implementations in infrastructure
2. **Use Case Driven** — Business logic encapsulated in application layer use cases
3. **Entity-Centric** — Domain entities are the heart of the system
4. **Repository Pattern** — All data access via repository interfaces
5. **Inversion of Control (IoC)** — Dependencies injected, not created

### Request Flow

```
HTTP Request
    ↓
[Hono Middleware] — Request ID, CORS, Request Logger
    ↓
[oRPC Router Procedure] — Input validation (Zod), auth middleware
    ↓
[Use Case] — Business logic orchestration, domain entity manipulation
    ↓
[Domain Service/Port] — Core business rules
    ↓
[Infrastructure Service] — External API calls, database operations
    ↓
JSON Response
```

---

## Repository Structure

### Monorepo Workspace Layout

```
kunci/                                  # Root monorepo
├── apps/
│   ├── api/                          # Backend service
│   │   ├── src/
│   │   │   ├── app.ts               # Hono app initialization
│   │   │   ├── main.ts              # Server bootstrap & lifecycle
│   │   │   ├── index.ts             # Exports
│   │   │   ├── migrate.ts           # Database migration runner
│   │   │   ├── domain/              # Domain entities & ports
│   │   │   │   ├── lead/
│   │   │   │   ├── email-message/
│   │   │   │   ├── email-sequence/
│   │   │   │   ├── behavior-analysis/
│   │   │   │   ├── opt-out/
│   │   │   │   ├── settings/
│   │   │   │   └── ports/           # Port interfaces
│   │   │   ├── application/         # Use cases
│   │   │   │   ├── lead/            # Lead capture, listing, enrichment
│   │   │   │   ├── research/        # Company research
│   │   │   │   ├── email/           # Email sending, reply handling
│   │   │   │   ├── pipeline/        # Lead pipeline orchestration
│   │   │   │   ├── scheduler/       # Scheduled tasks
│   │   │   │   ├── company-profile/ # Profile upload/management
│   │   │   │   ├── shared/          # Settings service, errors
│   │   │   │   └── use-cases.ts     # Use case factory (DI)
│   │   │   ├── infrastructure/      # Infrastructure implementations
│   │   │   │   ├── db/              # Drizzle schema, repositories, migrations
│   │   │   │   ├── ai/              # OpenRouter service
│   │   │   │   ├── email/           # Resend + IMAP services
│   │   │   │   ├── auth/            # Better Auth setup
│   │   │   │   ├── cache/           # Redis client
│   │   │   │   ├── queue/           # BullMQ pipeline queue
│   │   │   │   ├── scheduler/       # Croner cron jobs
│   │   │   │   ├── scraper/         # Deepcrawl integration
│   │   │   │   ├── linkedin/        # LinkedIn service
│   │   │   │   ├── notification/    # Slack notifications
│   │   │   │   ├── storage/         # File upload storage
│   │   │   │   ├── email-verification/ # MX verification
│   │   │   │   ├── observability/   # Logging, metrics
│   │   │   │   └── config/          # Environment config
│   │   │   └── presentation/        # HTTP layer
│   │   │       ├── orpc/            # oRPC context & middleware
│   │   │       └── routers/         # Procedure routers
│   │   ├── drizzle/                # Schema snapshots & migrations
│   │   ├── scripts/
│   │   │   └── bootstrap.sh        # Production startup script
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   ├── vitest.config.ts
│   │   └── tsconfig.json
│   │
│   ├── web/                        # Frontend application
│   │   ├── src/
│   │   │   ├── main.tsx           # React entry point
│   │   │   ├── routes/            # TanStack Router file-based routes
│   │   │   │   ├── __root.tsx     # Root layout
│   │   │   │   ├── _authenticated.tsx # Auth guard layout
│   │   │   │   └── _authenticated/ # Protected routes
│   │   │   ├── components/        # React components
│   │   │   ├── libs/              # Shared utilities
│   │   │   │   ├── auth/          # Auth client
│   │   │   │   ├── orpc/          # oRPC client setup
│   │   │   └── styles.css         # Global styles
│   │   ├── public/                # Static assets
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api-e2e/                   # API end-to-end tests
│   │   ├── src/
│   │   │   └── api.test.ts        # MSW-mocked integration tests
│   │   ├── vitest.config.ts
│   │   └── package.json
│   │
│   └── web-e2e/                   # Web UI end-to-end tests
│       ├── src/
│       └── package.json
│
├── docs/                          # Documentation
│   └── assets/                   # Screenshots, diagrams
├── assets/                        # Static assets (CSV templates, etc.)
├── package.json                   # Root workspace config
├── pnpm-workspace.yaml           # Workspace definition
├── tsconfig.base.json            # Base TypeScript config
├── biome.json                    # Linter/formatter config
├── docker-compose.dev.yml        # Dev environment (PostgreSQL + Redis)
├── docker-compose.yml            # Prod environment
├── Dockerfile                    # Multi-stage production build
└── CONTRIBUTING.md               # Development guidelines
```

### Path Aliases

- `#/` → `apps/api/src/` (backend)
- `~/` → `apps/web/src/` (frontend)

---

## Domain Model & Entities

### Core Entities

#### 1. **Lead**
Represents a prospect in the sales pipeline.

```typescript
interface Lead {
  id: string                           // UUID
  fullName: string                     // Prospect name
  email: string                        // Email (unique)
  companyName: string
  companyWebsite: string               // Website URL
  
  // Enrichment data
  painPoints?: string                  // Prospect pain points (AI-generated)
  companyResearch?: string             // Scraped company info
  companyIndustry?: string             // Industry classification
  companySize?: string                 // Estimated employee count
  linkedinUrl?: string                 // LinkedIn profile
  
  // Localization
  country?: string                     // ISO 3166-1 alpha-2 (e.g., ID, SG)
  locale?: string                      // BCP-47 locale (e.g., id-ID, en-SG)
  language?: string                    // Language code (e.g., id, en)
  timezone?: string                    // IANA timezone (e.g., Asia/Jakarta)
  
  // Pipeline state
  stage: LeadStage (0 | 1 | 2 | 3)     // 0=Captured, 1=Researched, 2=Sequenced, 3=Replied
  replyStatus: ReplyStatus             // pending, researching, research_failed, ready, 
                                       // awaiting, replied, bounced, completed, opted_out
  
  // Email tracking
  messageIds: string[]                 // Array of email message IDs
  latestMessageId?: string             // Most recent email
  lastEmailSentAt?: Date               // Last outbound send timestamp
  autoReplyTurns: number               // Number of auto-reply exchanges
  
  // Completion state
  completedReason?: CompletedReason    // won, opted_out, not_interested, cap_reached
  
  // Metadata
  leadSource?: string                  // Import source
  createdAt: Date
  updatedAt: Date
  enrichedAt?: Date                    // When enrichment completed
}

type LeadStage = 0 | 1 | 2 | 3
type ReplyStatus = 'pending' | 'researching' | 'research_failed' | 'ready' | 
                   'awaiting' | 'replied' | 'bounced' | 'completed' | 'opted_out'
type CompletedReason = 'won' | 'opted_out' | 'not_interested' | 'cap_reached'
```

#### 2. **EmailSequence**
A 3-email nurturing campaign generated per lead.

```typescript
interface EmailSequence {
  id: string
  leadId: string                       // FK to Lead
  emailNumber: 1 | 2 | 3               // Position in sequence
  subjectLines: string[]               // 2-3 variants for A/B testing
  content: string                      // Plain text email body
  htmlContent?: string                 // HTML email version
  cta: string                          // Call-to-action (e.g., "Schedule a call")
  psychologicalTrigger: string         // Psychology principle used (e.g., scarcity, social proof)
  sentAt?: Date                        // When email was actually sent
  createdAt: Date                      // When sequence was generated
}
```

#### 3. **EmailMessage**
Individual email sent or received.

```typescript
interface EmailMessage {
  id: string
  leadId: string                       // FK to Lead
  direction: 'inbound' | 'outbound'    // Who sent it
  subject: string
  textBody: string
  htmlBody?: string
  messageId?: string                   // Email Message-ID header
  inReplyTo?: string                   // References header (threading)
  intent?: ReplyIntent                 // AI classification of inbound reply
  createdAt: Date
}

type ReplyIntent = 'interested' | 'not_interested' | 'unsubscribe' | 
                   'objection' | 'question' | 'neutral'
```

#### 4. **BehaviorAnalysis**
AI-generated psychological profile of a prospect.

```typescript
interface BehaviorAnalysis {
  id: string
  leadId: string
  painPoints: string                   // Extracted pain points
  behavioralProfile: string            // Buyer persona (decision-maker, budget, influence)
  journeyStage: string                 // Awareness, Consideration, Decision
  psychologicalTriggers: string        // Applicable triggers (scarcity, social proof, etc.)
  optimalApproach: string              // Recommended sales approach
  conversionProbability: number        // 0.0-1.0 confidence score
  createdAt: Date
}
```

#### 5. **OptOut**
Email suppression registry for unsubscribe management.

```typescript
interface OptOut {
  email: string                        // PK (email address)
  token: string                        // Unique token for one-click unsubscribe
  reason?: string                      // Why they unsubscribed
  source: string                       // unsubscribe_link, api, bounce, etc.
  optedOutAt: Date
}
```

#### 6. **AppSettings**
Configurable settings stored in database.

```typescript
interface AppSettings {
  key: string                          // PK (e.g., "ai_model_openrouter")
  value: any                           // JSONB value
  category: string                     // ai, email, pipeline, etc.
  label: string                        // Human-readable label
  description?: string
  valueType: string                    // string, number, boolean, json
  updatedAt: Date
  updatedBy?: string                   // User ID who last updated
}
```

#### 7. **PipelineStep**
Granular tracking of pipeline execution stages.

```typescript
interface PipelineStep {
  id: string
  leadId: string
  step: string                         // capture, scrape, analyze_website, build_profile,
                                       // analyze_behavior, generate_sequence, send_email
  label: string                        // Human-readable label
  status: 'running' | 'completed' | 'failed'
  durationMs?: number                  // Execution time
  detail?: Record<string, unknown>     // Extra context (error, API URL, model, etc.)
  startedAt: Date
  completedAt?: Date
}
```

#### 8. **Auth Entities** (Better Auth)
User, Session, Account, Verification models are auto-generated by Better Auth.

---

## Application Layer & Use Cases

The application layer contains **orchestration logic** and **use cases**. Use cases coordinate repositories and services to implement business workflows.

### Use Case Categories

#### Lead Management
- `captureLead()` — Validate and save a single lead
- `bulkCaptureLead()` — Batch import from CSV with duplicate detection
- `getLeadDetail()` — Retrieve single lead with related data
- `listLeads()` — Query leads with filtering/pagination
- `enrichLead()` — Enrich lead with additional company data

#### Research & Enrichment
- `researchCompany()` — Scrape company website, analyze, generate insights using AI
- (Part of the pipeline, runs automatically on lead capture)

#### Email Pipeline
- `sendInitialEmail()` — Send first email from generated sequence
- `sendFollowupEmail()` — Send follow-up emails at scheduled times
- `handleReply()` — Process inbound email, classify intent, generate response
- `pollInboundMailbox()` — IMAP polling fallback for reply detection

#### Settings & Customization
- Settings sandbox allows users to:
  - Select AI models and adjust temperature/parameters
  - Create and test custom prompts
  - Configure email senders and sequences
  - Set pipeline cadence and follow-up timing

#### Opt-out Management
- `registerOptOut()` — Mark email as suppressed
- `checkOptOut()` — Verify before sending
- `unsubscribeByToken()` — Process one-click unsubscribe link

#### Pipeline Orchestration
- `runOutboundPipeline()` — Execute full pipeline for new lead (research → analyze → generate → send)
- `runOutboundForExistingLead()` — Re-run for existing lead (from BullMQ queue)
- `retryPipeline()` — Retry failed pipeline execution
- `processFollowups()` — Cron-triggered follow-up email scheduling

#### Company Profile Management
- `uploadCompanyProfile()` — Upload PDF/doc for company context
- `clearCompanyProfileFile()` — Remove uploaded file

### Dependency Injection Pattern

Use cases are created in `buildUseCases()` factory function, which wires all dependencies:

```typescript
export function buildUseCases(deps: AppDependencies) {
  // Repos
  const leadRepo = deps.repos.lead
  const sequenceRepo = deps.repos.sequence
  
  // Services
  const aiService = deps.services.ai
  const emailService = deps.services.email
  
  // Create use case instances
  const captureLead = makeCaptureLeadUseCase({
    leadRepo,
    emailVerifier: deps.services.emailVerifier,
    logger: deps.logger,
  })
  
  // Return interface
  return {
    lead: {
      capture: captureLead,
      list: listLeads,
      getDetail: getLeadDetail,
    },
    email: {
      sendInitial: sendInitialEmail,
      sendFollowup: sendFollowupEmail,
      handleReply: handleReply,
      pollInbound: inboundMailbox ? pollInbound : null,
    },
    // ... more use cases
  }
}
```

---

## Infrastructure Setup

### Services & Implementations

#### 1. **AI Service** (OpenRouter)
```
infrastructure/ai/openrouter-service.ts
├── LLM inference via OpenRouter API
├── Support for multiple models (Claude 3.5, Grok, GPT-4, etc.)
├── Custom temperature & parameters per model
├── 8 specialized prompts:
│   ├── Website analysis (extract company info)
│   ├── Behavior analysis (psychological profiling)
│   ├── Email sequence generation (3-email copy)
│   ├── Reply classification (intent detection)
│   ├── Reply personalization (custom responses)
│   └── (3 more for specific scenarios)
└── Settings-driven prompt customization
```

#### 2. **Email Service** (Resend)
```
infrastructure/email/resend-service.ts
├── Outbound email sending via Resend API
├── Dynamic sender (name & email configurable)
├── Webhook listener for bounces & delivery status
├── Inbound email fetching (if Resend Inbound MX enabled)
└── HTML + text multipart messages

Fallback: IMAP polling
infrastructure/email/imap-inbound.ts
├── Connects to IMAP mailbox (Gmail, Outlook, custom)
├── Polls at IMAP_POLL_INTERVAL_SECONDS (default 60s)
├── Filters unseen emails, parses with mailparser
├── Extracts sender, subject, body, attachments
└── Stores as inbound EmailMessage records
```

#### 3. **Scraper Service** (Deepcrawl)
```
infrastructure/scraper/deepcrawl-service.ts
├── Website crawling & HTML extraction
├── Returns plain text content per page
├── Respects robots.txt
└── Fallback: HTML parsing via cheerio
```

#### 4. **LinkedIn Service**
```
infrastructure/linkedin/linkedin-service.ts
├── LinkedIn profile scraping (gated by LINKEDIN_CRAWLING_PERMISSION_CONFIRMED)
├── Uses Deepcrawl or custom scraper
├── Extracts: title, company, headline, headline_position
└── Enriches Lead.linkedinUrl with parsed data
```

#### 5. **Database Layer** (Drizzle ORM)
```
infrastructure/db/
├── client.ts              # PostgreSQL connection pool (postgres)
├── schema.ts              # Table definitions
├── repositories/
│   ├── lead-repository.ts
│   ├── email-sequence-repository.ts
│   ├── email-message-repository.ts
│   ├── opt-out-repository.ts
│   ├── settings-repository.ts
│   └── pipeline-step-repository.ts
└── migrations/ (via drizzle-kit)
    ├── 0000_high_zeigeist.sql (initial schema)
    ├── 0001_glamorous_firebird.sql
    └── ... (incremental migrations)
```

**Key Features:**
- Type-safe SQL queries (Drizzle introspection)
- Cascading deletes (lead → related messages/sequences)
- JSON columns for complex data (behavior_analyses.detail)
- Timezone-aware timestamps
- Full-text search ready (not yet enabled)

#### 6. **Cache Layer** (Redis)
```
infrastructure/cache/redis.ts
├── ioredis client
├── Connection pooling
├── Used for:
│   ├── Settings cache (with TTL)
│   ├── BullMQ job storage (pipeline queue)
│   └── Session storage (Better Auth)
└── Default: redis://127.0.0.1:27096
```

#### 7. **Job Queue** (BullMQ)
```
infrastructure/queue/bullmq-pipeline-queue.ts
├── Pipeline job enqueueing
├── Worker concurrency control (PIPELINE_WORKER_CONCURRENCY = 3 default)
├── Rate limiting (PIPELINE_RATE_MAX jobs per PIPELINE_RATE_DURATION_MS)
├── Delay scheduling (for optimal send times)
├── Automatic retry & backoff
├── Redis-backed persistence
└── Worker lifecycle management (start/stop)
```

#### 8. **Scheduler** (Croner)
```
infrastructure/scheduler/cron.ts
├── Cron-based scheduled task execution
├── Configured tasks:
│   ├── Daily follow-up processing (processFollowups)
│   └── Customizable cron expressions per task
└── Runs alongside HTTP server
```

#### 9. **Authentication** (Better Auth)
```
infrastructure/auth/better-auth.ts
├── Multi-provider auth (email/password, social, OAuth)
├── Session-based authentication
├── CSRF protection
├── Account & verification tables
├── Drizzle ORM adapter for persistence
└── Middleware for request authentication
```

#### 10. **Notification Service** (Slack)
```
infrastructure/notification/
├── slack-service.ts    # Sends formatted messages to Slack webhook
└── noop-service.ts     # No-op fallback if webhook not configured
```

#### 11. **File Storage** (Local Disk)
```
infrastructure/storage/local-disk-storage.ts
├── Local file uploads (company profiles, CSVs)
├── Configurable root directory (UPLOAD_DIR = ./uploads)
├── File size limits (UPLOAD_MAX_BYTES = 10MB default)
└── Used for user-uploaded documents
```

#### 12. **Email Verification** (MX Check)
```
infrastructure/email-verification/mx-verifier.ts
├── DNS MX record validation
├── Prevents invalid email capture
└── Lightweight check before database insert
```

#### 13. **Logging** (Pino)
```
infrastructure/observability/logger.ts
├── Structured JSON logging
├── Log levels: debug, info, warn, error, fatal
├── Request ID propagation
├── Context fields (leadId, userId, duration, etc.)
└── Pretty-printing in dev (pino-pretty)
```

#### 14. **Configuration** (Zod + Environment)
```
infrastructure/config/env.ts
├── Runtime environment validation (Zod schemas)
├── Type-safe config object
├── Sensible defaults
├── Production-specific validation rules
│   ├── RESEND_WEBHOOK_SECRET required in production
│   ├── Minimum secret lengths
│   └── URL format validation
└── Used throughout the app via import
```

---

## Database Schema & Migrations

### Tables Overview

**Core Tables:**
- `leads` — Prospect records
- `email_sequences` — Generated 3-email campaigns
- `email_messages` — Sent/received emails
- `behavior_analyses` — AI-generated psychological profiles
- `opt_outs` — Unsubscribe suppression list
- `pipeline_steps` — Granular execution tracking
- `activity_log` — Audit trail (future use)
- `app_settings` — Configurable system settings

**Authentication Tables:**
- `user` — User accounts (Better Auth)
- `session` — Login sessions
- `account` — External provider accounts
- `verification` — Email/password recovery tokens

### Key Schema Features

**Cascading Deletes:**
```sql
-- Deleting a lead automatically removes:
-- - All email_sequences for that lead
-- - All email_messages for that lead
-- - Associated pipeline_steps
-- - Related behavior_analyses
```

**Unique Constraints:**
```sql
-- One record per email (prevents duplicate lead capture)
UNIQUE(email)
-- Opt-out tokens are unique (for unsubscribe links)
UNIQUE(token)
-- User emails are unique
UNIQUE(email)
```

**Timezone Support:**
```sql
-- Timestamps include timezone info
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
last_email_sent_at TIMESTAMP WITH TIME ZONE
```

**JSON Fields:**
```sql
-- pipelineSteps.detail stores extra context
detail JSONB  -- Stores error messages, API URLs, model names, etc.
-- appSettings.value is JSON
value JSONB   -- Flexible typed settings
```

### Migration Management

**Drizzle Kit Commands:**
```bash
pnpm db:generate    # Generate schema snapshot
pnpm db:push        # Push schema to database (dev only)
pnpm db:migrate     # Run migrations (production)
pnpm db:studio      # Drizzle Studio UI (debug schema)
pnpm db:seed        # Seed test data
```

**Migration Workflow:**
1. Edit `infrastructure/db/schema.ts`
2. Run `pnpm db:generate` → creates SQL in `drizzle/`
3. Test locally with `pnpm db:push`
4. Commit both schema + migration SQL
5. Production: `pnpm db:migrate` runs generated SQL

---

## API & Presentation Layer

### oRPC Framework

**oRPC** is a type-safe RPC framework that provides:
- **End-to-end type safety** — Frontend knows exact API types
- **No code generation** — Types inferred from procedures
- **Composable middleware** — Authentication, validation, logging
- **Automatic OpenAPI** — Self-documenting API

### Router Structure

```
presentation/routers/
├── index.ts              # AppRouter combines all routers
├── lead.ts               # Lead-related procedures
├── campaign.ts           # Campaign/dashboard procedures
├── settings.ts           # Settings management
└── sandbox.ts            # Prompt testing sandbox
```

### Lead Router Endpoints

```typescript
export const leadRouter = os.$context<ORPCContext>().router({
  // Single lead capture
  capture: publicProcedure
    .input(captureLeadSchema)
    .handler(async ({ input, context }) => {
      // 1. Validate & save lead
      const lead = await context.useCases.lead.capture(input)
      
      // 2. Enqueue to pipeline (with delay for optimal send time)
      const delayMs = computeSendDelayMs(lead.timezone, sendWindow)
      await context.useCases.pipeline.enqueue(lead.id, { delayMs })
      
      return { leadId: lead.id, status: "pipeline_enqueued", delayMs }
    }),

  // Bulk CSV import
  captureBulk: protectedProcedure
    .input(bulkCaptureLeadSchema)
    .output(bulkCaptureResultSchema)
    .handler(async ({ input, context }) => {
      // Process array of leads with:
      // - Duplicate detection
      // - Opt-out check
      // - Email verification
      // - Returns: created, duplicates, invalid, suppressed, enqueued count
    }),

  // Retrieve leads with pagination
  list: protectedProcedure
    .input(listLeadsSchema)
    .handler(async ({ input, context }) => {
      return context.useCases.lead.list({
        page: input.page,
        limit: input.limit,
        stage: input.stage,
        replyStatus: input.replyStatus,
        searchTerm: input.searchTerm,
      })
    }),

  // Get single lead detail
  getDetail: protectedProcedure
    .input(z.object({ leadId: z.string() }))
    .handler(async ({ input, context }) => {
      return context.useCases.lead.getDetail(input.leadId)
    }),
})
```

### Campaign Router
Dashboard & metrics:
- Lead count by stage
- Response rates
- Email delivery metrics
- Pipeline conversion funnel

### Settings Router
Allow authenticated users to:
- Configure AI models & temperatures
- Customize email prompts
- Set pipeline cadence
- Manage email senders
- Toggle IMAP polling

### Sandbox Router
Prompt testing & validation:
- Test LLM prompts with sample input
- Preview email sequence generation
- Validate behavior analysis
- Live preview of AI output

### Middleware Stack

```typescript
// 1. Request ID generation
app.use(requestId())

// 2. CORS headers
app.use(cors())

// 3. Request logging
app.use(createRequestLogger(logger))

// 4. oRPC handler
app.fetch = new RPCHandler({
  router: appRouter,
  request: HonoRequest,
}).fetch
```

### Authentication Middleware

```typescript
// Public procedure (no auth required)
export const publicProcedure = os.$context<ORPCContext>()
  .use(async (opts) => {
    opts.next({
      ...opts.context,
      session: null,
    })
  })

// Protected procedure (requires authentication)
export const protectedProcedure = os.$context<ORPCContext>()
  .use(async (opts) => {
    const session = await getSession(opts.context.headers)
    if (!session) throw new UnauthorizedError("Not authenticated")
    opts.next({
      ...opts.context,
      session,
    })
  })
```

### Webhook Endpoints

#### Resend Webhook (Email Delivery)
```
POST /webhooks/resend
- Listens for email delivery, bounce, unsubscribe events
- Updates lead status based on bounce/delivery
- Processes inbound emails if Resend Inbound MX enabled
```

#### Health Check Endpoints
```
GET /healthz     → Returns { status: "ok" }
GET /ready       → Checks Redis connectivity, returns 200 if ready
```

---

## Frontend Application

### Technology & Setup

**File-based routing** with TanStack Router:
```
src/routes/
├── __root.tsx                    # Root layout (Outlet)
├── _authenticated.tsx            # Auth guard layout
├── _authenticated/
│   ├── dashboard.tsx             # Dashboard/overview
│   ├── leads/
│   │   ├── index.tsx            # Leads list/table
│   │   └── $leadId.tsx          # Lead detail view
│   ├── bulk-import.tsx          # CSV import
│   ├── settings.tsx             # Settings page
│   └── sandbox.tsx              # Prompt sandbox
├── auth/
│   ├── login.tsx
│   ├── signup.tsx
│   └── callback.tsx             # OAuth callback
└── index.tsx                    # Landing page
```

### State Management

**React Query (TanStack Query):**
- Server state caching
- Automatic refetching & invalidation
- Background sync
- Optimistic updates

**React Form (TanStack Form):**
- Type-safe form state
- Validation integration
- Submission handling

**React Router Context:**
- Route params, query strings
- Navigation

### Component Architecture

**UI Library:** `@kana-consultant/ui-kit`
- Pre-built components: Button, Input, Modal, Table, Sidebar, etc.
- Consistent design system
- TailwindCSS-based

**Local Components:**
```
src/components/
├── lead-form.tsx              # Lead capture form
├── bulk-import/
│   └── csv-uploader.tsx       # CSV file handling
├── settings/
│   ├── ai-settings.tsx        # Model & temperature config
│   ├── prompt-editor.tsx      # Custom prompt editing
│   └── email-settings.tsx     # Sender configuration
├── lead-table.tsx             # Leads list table (React Table)
└── dashboard-metrics.tsx       # KPI cards
```

### API Integration

**oRPC Client:**
```typescript
// libs/orpc/client.ts
import { createORPCClient } from "@orpc/client"
import type { AppRouter } from "@kunci/api"

export const apiClient = createORPCClient<AppRouter>({
  baseURL: import.meta.env.VITE_API_URL,
  headers: async () => {
    // Add auth token from session
    const token = getSessionToken()
    return { Authorization: `Bearer ${token}` }
  },
})
```

**Usage in Components:**
```typescript
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "~/libs/orpc/client"

function LeadList() {
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => apiClient.lead.list({ page: 1, limit: 20 }),
  })
  
  return <table>{/* render leads */}</table>
}
```

### Authentication Flow

**Better Auth Integration:**
```typescript
// libs/auth/client.ts
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
})

// Usage
const { useSession } = authClient
function Dashboard() {
  const { data: session } = useSession()
  return session ? <DashboardContent /> : <LoginPrompt />
}
```

### Styling

**TailwindCSS 4.0** with custom configuration:
- Mobile-first responsive design
- Dark mode support (via CSS variables)
- Custom theme colors
- Typography plugin for prose styling

---

## Authentication & Security

### Better Auth Setup

**Features:**
- Email/password authentication
- OAuth 2.0 support (social login)
- Magic links (passwordless)
- Multi-factor authentication ready
- Drizzle ORM adapter for data persistence

**Session Management:**
- Cookie-based sessions (httpOnly, Secure, SameSite)
- Token refresh mechanism
- Automatic session validation
- CSRF protection

### Authorization

**Role-Based Access Control (RBAC):**
```typescript
// Stored in user.role column
- admin       // Full access
- user        // Standard user access
- readonly    // View-only access
```

**Procedure-Level Guards:**
```typescript
// Public (no auth)
publicProcedure

// Authenticated only
protectedProcedure
  .use(async (opts) => {
    const session = await getSession(opts.context.headers)
    if (!session) throw new UnauthorizedError()
    opts.next({ ...opts.context, session })
  })

// Admin only (in future)
adminProcedure
  .use(async (opts) => {
    if (opts.context.session?.user.role !== "admin") {
      throw new ForbiddenError()
    }
    opts.next(opts.context)
  })
```

### Security Hardening

**Production Dockerfile:**
- Non-root user execution (`kunci:kunci`)
- Dropped capabilities (only needed ones)
- Read-only root filesystem
- Memory & CPU limits
- Health checks

**Environment Validation:**
- Zod runtime validation
- Required secret validation
- Type-safe config at runtime
- Production-specific rules

**Database Security:**
- SCRAM-SHA-256 password authentication (not trust)
- No public port exposure in production
- Parameterized queries (Drizzle ORM prevents injection)

---

## Testing Strategy

### Test Setup

**Framework:** Vitest 3.2.4
- Native ESM support
- Fast in-process execution
- API mocking with MSW (Mock Service Worker)

**File Colocation:**
```
src/
├── application/
│   ├── lead/
│   │   ├── capture-lead.ts
│   │   └── capture-lead.test.ts    ← Tests colocated
│   ├── email/
│   │   ├── send-email.ts
│   │   └── send-email.test.ts
│   └── ...
```

### Test Types

**Unit Tests:**
- Use case logic in isolation
- Mock repositories & services
- Test error handling, edge cases

**Integration Tests (api-e2e):**
```typescript
// api-e2e/src/api.test.ts
// MSW intercepts HTTP calls:
// - OpenRouter API → Mocked LLM response
// - Resend Email API → Mocked send
// - Tests full flow: capture → research → generate → send
```

**E2E Tests (web-e2e):**
- UI interactions
- Navigation flows
- Form submissions
- Dashboard functionality
- (Planned implementation)

### Mock Setup (MSW)

```typescript
const server = setupServer(
  // OpenRouter
  http.post("https://openrouter.ai/api/v1/chat/completions", () => {
    return HttpResponse.json({
      choices: [{ message: { content: "AI response" } }],
    })
  }),
  
  // Resend
  http.post("https://api.resend.com/emails", () => {
    return HttpResponse.json({ id: "msg-123" })
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Test Commands

```bash
pnpm test              # Run all tests
pnpm test --coverage   # Generate coverage report
pnpm test --watch      # Watch mode
pnpm typecheck         # Type checking across monorepo
```

---

## Deployment & DevOps

### Docker Architecture

**Multi-stage Build:**

```dockerfile
# Stage 1: Dependencies
  Install pnpm, copy package files

# Stage 2: Build API
  Compile TypeScript, bundle with tsup

# Stage 3: Build Web
  Build React app with Vite

# Stage 4: Production Dependencies
  Install only production deps

# Stage 5: Runtime
  Final image with:
  - Node.js 22 Alpine
  - Non-root user
  - Security hardening
  - Both API & Web builds
  - Drizzle migrations
```

**Build Output:**
```
/app/
├── node_modules/          # Production dependencies
├── apps/api/
│   ├── dist/              # Compiled backend
│   ├── src/               # Source (needed for tsx migrations)
│   └── drizzle/           # Migration SQL files
└── apps/web/
    └── dist/              # Built React app
```

### Docker Compose

**Development (docker-compose.dev.yml):**
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: kunci
      POSTGRES_DB: kunci
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

**Production (docker-compose.yml):**
```yaml
services:
  api:
    build: .                    # Uses Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3005:3005"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://kunci:${POSTGRES_PASSWORD}@postgres:7432/kunci
      REDIS_URL: redis://redis:7379
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:3005/healthz"]
      interval: 30s

  postgres:
    image: postgres:17-alpine
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_OVERRIDE, SETUID, SETGID]
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"

  redis:
    image: redis:7-alpine
    # No external port exposure
    deploy:
      resources:
        limits:
          memory: 256M
```

### Startup Process

```bash
# 1. Docker entrypoint
/sbin/tini --  # PID 1 signal handler

# 2. Bootstrap script
/app/apps/api/scripts/bootstrap.sh
  └─ Run migrations (if needed)
  └─ Seed database (if needed)
  └─ Start Node.js server

# 3. Server initialization (main.ts)
  ├─ Initialize infrastructure (DB, Redis, AI, Email)
  ├─ Build dependency injection (use cases)
  ├─ Start Hono HTTP server (port 3001)
  ├─ Start BullMQ worker for pipeline queue
  ├─ Start Croner scheduler for cron jobs
  └─ Setup graceful shutdown handlers
```

### Deployment Checklist

**Pre-deployment:**
```bash
1. pnpm lint              # Code quality
2. pnpm typecheck         # No type errors
3. pnpm test              # All tests pass
4. docker build .         # Image builds successfully
```

**Environment Setup:**
```bash
1. Copy .env.example → .env.production
2. Fill in all required secrets:
   - DATABASE_URL (PostgreSQL)
   - REDIS_URL
   - OPENROUTER_API_KEY
   - RESEND_API_KEY
   - DEEPCRAWL_API_KEY
   - BETTER_AUTH_SECRET
   - SENDER_EMAIL / SENDER_NAME
   - Optional: SLACK_WEBHOOK_URL
```

**Deployment:**
```bash
1. docker-compose -f docker-compose.yml up -d
2. Monitor: docker logs kunci-api-1
3. Health check: curl http://localhost:3005/healthz
```

---

## Configuration & Environment

### Required Environment Variables

#### Database & Cache
```
DATABASE_URL=postgres://user:password@host:5432/kunci
REDIS_URL=redis://localhost:6379
```

#### AI & LLM
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MAX_CONCURRENCY=3           # Max concurrent API calls
```

#### Email
```
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=...              # Production only
SENDER_EMAIL=noreply@kunci.ai
SENDER_NAME=KUNCI AI SDR
SENDER_COMPANY=KUNCI.AI
```

#### Website Scraping
```
DEEPCRAWL_API_KEY=...
LINKEDIN_CRAWLING_PERMISSION_CONFIRMED=true|false
```

#### Authentication
```
BETTER_AUTH_SECRET=...                 # Min 16 chars
BETTER_AUTH_URL=http://localhost:3001  # Callback URL
```

#### Server Configuration
```
PORT=3001                              # API port
WEB_ORIGIN=http://localhost:5418       # Frontend origin (for CORS)
NODE_ENV=development|production|test
```

#### Pipeline & Queue
```
PIPELINE_WORKER_CONCURRENCY=3          # BullMQ concurrency
PIPELINE_RATE_MAX=10                   # Max jobs per window
PIPELINE_RATE_DURATION_MS=1000         # Rolling window (ms)
PIPELINE_AUTO_ENQUEUE=true             # Auto-enqueue on lead capture
```

#### Email Inbound (Optional)
```
IMAP_ENABLED=true|false
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your@email.com
IMAP_PASSWORD=app_password
IMAP_MAILBOX=INBOX
IMAP_BATCH_SIZE=25
IMAP_POLL_INTERVAL_SECONDS=60          # How often to check
```

#### File Uploads
```
UPLOAD_DIR=./uploads                   # Local storage path
UPLOAD_MAX_BYTES=10485760              # 10 MB
```

#### Notifications
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # Optional
```

### Environment Validation (Zod)

```typescript
// All variables validated at startup
// Type errors caught immediately
// Default values applied if not specified
// Production-specific rules enforced

export const env = envSchema.parse(process.env)
// Now fully typed: env.DATABASE_URL, env.OPENROUTER_API_KEY, etc.
```

---

## Development Workflow

### Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/kunci-ai/kunci.git
cd kunci

# 2. Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# 3. Install dependencies
pnpm install

# 4. Copy environment
cp .env.example .env
# Edit .env with your API keys

# 5. Run migrations
pnpm db:push

# 6. Start development servers (both API and Web)
pnpm dev
# Or run individually:
# pnpm dev:api     (port 3001)
# pnpm dev:web     (port 5418)
```

### Code Quality Tools

```bash
pnpm lint              # Check for issues
pnpm lint:fix          # Auto-fix formatting & simple issues
pnpm format            # Format code
pnpm typecheck         # TypeScript type checking
pnpm test              # Run all tests
pnpm test --coverage   # With coverage report
```

### Git Workflow

**Branch naming:**
```
feat/feature-name           # New feature
fix/bug-description         # Bug fix
test/test-coverage-area     # Test improvements
chore/tooling-update        # Dependencies, config
agent/TASK-ID-description   # AI agent PRD tasks
```

**Commit convention:**
```
<type>(<scope>): <subject>

<body>

Refs: <task-id>
```

Example:
```
feat(ai): add reasoning model temperature guard

Implemented temperature limits for OpenRouter models to prevent
excessive reasoning output that causes latency issues. Applied 
validation before every LLM call.

Refs: PRD TASK-004
```

**Hard Constraints (require human review):**
- Schema migrations with data loss
- New 3rd-party dependencies (beyond core stack)
- Major version bumps (React, Hono, Drizzle, Better Auth)
- Changes to auth, email, or LLM provider

---

## Summary: System Integration

### Data Flow: Lead Capture to Reply

```
1. USER CAPTURES LEAD (Web UI)
   ├─ Input: fullName, email, company, website
   └─ POST /rpc/lead.capture

2. CAPTURE ENDPOINT (publicProcedure)
   ├─ Validate email format & domain (MX check)
   ├─ Check for duplicates & opt-outs
   ├─ Save lead to database (stage=0)
   └─ Enqueue to BullMQ pipeline (with delay for timezone)

3. PIPELINE JOB (BullMQ Worker)
   ├─ Fetch lead from database
   ├─ Stage 1: Scrape company website (Deepcrawl)
   ├─ Stage 2: Generate behavior profile (OpenRouter LLM)
   ├─ Stage 3: Generate 3-email sequence (AI with prompts)
   ├─ Stage 4: Send first email (Resend API)
   └─ Update lead.stage incrementally

4. EMAIL DELIVERY & TRACKING
   ├─ Resend webhook: bounce/delivered events
   ├─ Lead.replyStatus updated based on bounces
   └─ Pipeline Step records created for audit trail

5. INBOUND REPLY HANDLING
   ├─ Option A: Resend Inbound webhook (real-time)
   ├─ Option B: IMAP polling (every 60s)
   ├─ Parse email, classify intent (AI)
   ├─ Generate response (AI)
   ├─ Send reply (Resend)
   └─ Increment autoReplyTurns counter

6. SCHEDULED FOLLOW-UPS
   ├─ Croner runs daily at configured time
   ├─ Fetch leads with pending follow-ups
   ├─ Send email #2, then #3 at intervals
   └─ Mark completed when sequence done
```

### Technology Integration Points

| Component | Role | Integration |
|-----------|------|-------------|
| PostgreSQL | Data persistence | Drizzle ORM queries |
| Redis | Caching & job queue | ioredis client, BullMQ |
| OpenRouter | LLM inference | HTTP API calls via ai-service |
| Resend | Email delivery | HTTP API calls via email-service |
| Deepcrawl | Website scraping | HTTP API via scraper-service |
| Hono | HTTP server | Express-like routing & middleware |
| oRPC | RPC framework | Type-safe procedures + middleware |
| Better Auth | Authentication | Cookie-based sessions, Drizzle adapter |
| Croner | Job scheduling | Cron expressions for background jobs |
| Biome | Linting | Pre-commit hooks via lint-staged |
| Vitest | Testing | Unit & integration tests with MSW |
| Docker | Containerization | Multi-stage build for prod |

---

## Key Patterns & Best Practices

### 1. **Clean Architecture Adherence**
- Strict dependency direction (presentation → application → domain → infrastructure)
- Domain layer has NO external dependencies
- All external services via Port interfaces

### 2. **Use Case Factory Pattern**
- Centralized dependency injection in `buildUseCases()`
- All use cases wired with consistent dependencies
- Testable: services can be mocked

### 3. **Repository Pattern**
- All data access through repository interfaces
- Implementations in infrastructure layer
- Easy to swap (in-memory for tests, PostgreSQL for production)

### 4. **Middleware Stack**
- Composable middleware in both Hono and oRPC
- Request logging, CORS, authentication at HTTP layer
- Authorization at procedure layer

### 5. **Type Safety**
- Zod schemas for validation (input/output)
- TypeScript strict mode
- oRPC end-to-end types (frontend knows exact API shape)

### 6. **Error Handling**
- Domain exceptions (BadRequest, UnauthorizedError, etc.)
- Caught at HTTP layer, serialized to JSON
- Consistent error response format

### 7. **Testing Strategy**
- Unit tests: isolated use case logic
- Integration tests: full flow with mocked externals (MSW)
- E2E tests: UI interactions

### 8. **Logging**
- Structured Pino logs with context
- Request ID propagation across services
- Different levels for different environments

---

## Performance Considerations

### Database Optimization
- Indexed foreign keys (lead_id)
- Unique constraints prevent N+1 queries
- Cascading deletes maintain referential integrity
- JSON columns for flexible metadata

### Caching Strategy
- Settings cached in Redis with TTL
- Reduces database queries for frequently accessed config
- Cache invalidation on settings update

### Job Queue Rate Limiting
- BullMQ rate limiting: PIPELINE_RATE_MAX jobs per PIPELINE_RATE_DURATION_MS
- Prevents overwhelming external APIs (OpenRouter, Resend, Deepcrawl)
- Graceful backoff & retry

### Email Send Timing
- Delay calculation based on prospect timezone
- Emails sent during business hours (9am-5pm recipient time)
- Reduces bounce rates & improves engagement

### Concurrency Control
- BullMQ worker concurrency = 3 (default)
- OpenRouter API concurrency = 3 (default)
- Prevents resource exhaustion

---

## Future Extensibility

### Planned Integrations
- Custom email provider support (SendGrid, Mailgun)
- Webhook batching for high-volume scenarios
- Analytics & reporting dashboard
- Slack integration for notifications
- Zapier/automation platform connectors

### Customization Points
- Prompt templates per user/company
- Custom email templates
- Lead scoring rules
- Workflow automation triggers
- Multi-language support (already prepared with locale/language fields)

### Scalability Path
- Database connection pooling (Drizzle supports multiple pools)
- Redis cluster for distributed caching
- Job queue sharding (BullMQ supports multiple queues)
- CDN for static assets
- API rate limiting per user tier
