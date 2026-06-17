import type { CreateLeadInput, LeadSegment } from "#/domain/lead/lead.ts"

export function detectSegment(input: CreateLeadInput): LeadSegment {
	const emailDomain = input.email.split("@")[1]?.toLowerCase()

	if (["gmail.com", "yahoo.com", "hotmail.com"].includes(emailDomain ?? "")) {
		return "talent"
	}

	if (!input.companyWebsite || input.companyWebsite.trim() === "") {
		return "talent"
	}

	return "enterprise"
}
