import type { CreateLeadInput } from "#/domain/lead/lead.ts"
import { detectSegment } from "./detect-segment.ts"
import { inferLocaleFromEmail } from "./locale-inference.ts"

/**
 * Shared enrichment applied to every lead input before persistence.
 * Normalizes email, resolves segment (client-set wins, fallback to
 * auto-detection), and fills in geo-inferred locale when the caller
 * hasn't supplied one.
 *
 * Called by both single capture and bulk capture so the rules never
 * diverge between the two code paths (DRY, SSOT).
 */
export function enrichLeadInput(input: CreateLeadInput): CreateLeadInput {
	const normalizedEmail = input.email.trim().toLowerCase()
	const segment = input.segment ?? detectSegment(input)
	const inferred = inferLocaleFromEmail(normalizedEmail)
	return {
		...input,
		email: normalizedEmail,
		segment,
		country: input.country ?? inferred.country ?? undefined,
		locale: input.locale ?? inferred.locale ?? undefined,
		language: input.language ?? inferred.language ?? undefined,
		timezone: input.timezone ?? inferred.timezone ?? undefined,
	}
}
