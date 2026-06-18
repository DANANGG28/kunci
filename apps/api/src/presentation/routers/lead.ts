import { os } from "@orpc/server"
import { z } from "zod"
import {
	computeSendDelayMs,
	loadSendWindowOptions,
} from "#/application/lead/send-window.ts"
import { detectSegment } from "#/application/lead/detect-segment.ts"
import { badRequest } from "#/application/shared/errors.ts"
import { SETTING_KEYS } from "#/domain/settings/setting-keys.ts"
import type { ORPCContext } from "#/presentation/orpc/context"
import {
	protectedProcedure,
	publicProcedure,
} from "#/presentation/orpc/middleware"

const DEFAULT_BULK_CAPTURE_LIMIT = 100
const ABSOLUTE_BULK_CAPTURE_LIMIT = 1000

function isLinkedInUrl(value: string): boolean {
	try {
		const url = new URL(value)
		if (url.protocol !== "https:" && url.protocol !== "http:") return false
		const hostname = url.hostname.toLowerCase()
		return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
	} catch {
		return false
	}
}

const linkedinUrlSchema = z.preprocess(
	(value) => (value === "" ? undefined : value),
	z
		.string()
		.max(2048, "URL too long")
		.url("Valid LinkedIn URL is required")
		.refine(isLinkedInUrl, "URL must use linkedin.com")
		.optional(),
)

const MAX_URL_LENGTH = 2048

const captureLeadSchema = z
	.object({
		fullName: z
			.string()
			.min(1, "Name is required")
			.max(200, "Name too long"),
		email: z.string().email("Valid email is required").max(254, "Email too long"),
		companyName: z
			.string()
			.min(1, "Company name is required")
			.max(200, "Company name too long"),
		companyWebsite: z
			.string()
			.min(1, "Website URL is required")
			.max(MAX_URL_LENGTH, "URL too long")
			.url("Valid website URL is required")
			.refine(
				(val) => {
					const scheme = new URL(val).protocol
					return scheme === "https:" || scheme === "http:"
				},
				"URL must use http or https",
			),
		segment: z
			.enum(["talent", "agency", "enterprise"])
			.optional(),
		painPoints: z.string().max(5000, "Pain points too long").optional(),
		leadSource: z.string().max(200, "Lead source too long").optional(),
		linkedinUrl: linkedinUrlSchema,
	})
	.superRefine((data, ctx) => {
		const computedSegment = data.segment ?? detectSegment(data)

		// Website is required for non-talent segments
		if (computedSegment !== "talent" && !data.companyWebsite) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Website is required for non-talent leads",
				path: ["companyWebsite"],
			})
		}
	})

const bulkCaptureLeadSchema = z.object({
	leads: z
		.array(captureLeadSchema)
		.min(1, "At least one lead is required")
		.max(
			ABSOLUTE_BULK_CAPTURE_LIMIT,
			`Maximum ${ABSOLUTE_BULK_CAPTURE_LIMIT} leads per request`,
		),
})

export const leadRouter = os.$context<ORPCContext>().router({
	capture: publicProcedure
		.input(captureLeadSchema)
		.handler(async ({ input, context }) => {
			// Phase 1: Capture lead synchronously (fast — validate + save to DB)
			const lead = await context.useCases.lead.capture(input)

			// Phase 2: Hand off the pipeline to BullMQ. Delay the job until the
			// lead's local business hours so the email lands at a reasonable time.
			const sendWindow = await loadSendWindowOptions(context.useCases.settings)
			const delayMs = computeSendDelayMs(lead.timezone, sendWindow)
			await context.useCases.pipeline.enqueue(lead.id, { delayMs })

			return { leadId: lead.id, status: "pipeline_enqueued", delayMs }
		}),

	captureBulk: protectedProcedure
		.input(bulkCaptureLeadSchema)
		.output(
			z.object({
				created: z.array(z.any()),
				duplicates: z.array(
					z.object({
						email: z.string(),
						fullName: z.string(),
						reason: z.string(),
					}),
				),
				invalid: z.array(
					z.object({
						email: z.string(),
						fullName: z.string(),
						reason: z.string(),
					}),
				),
				suppressed: z.array(
					z.object({
						email: z.string(),
						fullName: z.string(),
						reason: z.string(),
					}),
				),
				enqueued: z.number(),
			}),
		)
		.handler(async ({ input, context }) => {
			const maxLeads = await getBulkCaptureLimit(context)
			if (input.leads.length > maxLeads) {
				throw badRequest(`Maximum ${maxLeads} leads per batch`)
			}

			const result = await context.useCases.lead.bulkCapture(input.leads)

			// Stagger enqueues so we don't fire 100 jobs at the exact same
			// instant. BullMQ has its own rate limit but downstream providers
			// (Resend, OpenRouter) are happier with a gentler ramp.
			// Also delay each job into the lead's local business hours.
			const sendWindow = await loadSendWindowOptions(context.useCases.settings)
			let enqueued = 0
			for (const [i, lead] of result.created.entries()) {
				try {
					const windowDelay = computeSendDelayMs(lead.timezone, sendWindow)
					await context.useCases.pipeline.enqueue(lead.id, {
						delayMs: windowDelay + i * 250,
					})
					enqueued++
				} catch (err) {
					context.logger.error(
						{ err, leadId: lead.id },
						"Failed to enqueue lead pipeline job",
					)
				}
			}

			return { ...result, enqueued }
		}),

	list: protectedProcedure
		.input(
			z.object({
				page: z.number().int().positive().default(1),
				limit: z.number().int().positive().max(100).default(20),
				stage: z.number().optional(),
				status: z.string().max(50).optional(),
			}),
		)
		.output(
			z.object({
				leads: z.array(z.any()),
				total: z.number(),
			}),
		)
		.handler(async ({ input, context }) => {
			return context.useCases.lead.list(input)
		}),

	getDetail: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.output(z.any())
		.handler(async ({ input, context }) => {
			return context.useCases.lead.getDetail(input.id)
		}),

	getPipelineSteps: protectedProcedure
		.input(z.object({ leadId: z.string().uuid() }))
		.output(z.array(z.any()))
		.handler(async ({ input, context }) => {
			return context.useCases.pipeline.getSteps(input.leadId)
		}),
	retry: protectedProcedure
		.input(z.object({ leadId: z.string().uuid() }))
		.output(z.object({ status: z.string() }))
		.handler(async ({ input, context }) => {
			return context.useCases.pipeline.retry(input.leadId)
		}),
})

async function getBulkCaptureLimit(context: ORPCContext): Promise<number> {
	const configuredLimit = await context.useCases.settings.get<number | string>(
		SETTING_KEYS.PIPELINE_BULK_IMPORT_MAX,
		DEFAULT_BULK_CAPTURE_LIMIT,
	)
	const limit = Number(configuredLimit)

	if (!Number.isFinite(limit) || limit < 1) {
		return DEFAULT_BULK_CAPTURE_LIMIT
	}

	return Math.min(Math.floor(limit), ABSOLUTE_BULK_CAPTURE_LIMIT)
}
