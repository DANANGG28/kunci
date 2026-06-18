import type { CreateLeadInput, LeadSegment } from "#/domain/lead/lead.ts"

const FREE_EMAIL_DOMAINS = new Set(["gmail.com", "yahoo.com", "hotmail.com"])

/**
 * Common recruitment / staffing agency domains.
 * Used as a signal for auto-detecting the "agency" segment.
 */
const AGENCY_EMAIL_DOMAINS = new Set([
	"greenhouse.io",
	"lever.co",
	"workable.com",
	"breezy.hr",
	"recruitee.com",
	"teamtailor.com",
	"ashbyhq.com",
	"zoho.eu",
	"zoho.com",
	"jazzhr.com",
	"pinpointhq.com",
	"freshteam.com",
	"bamboohr.com",
])

const AGENCY_KEYWORDS = ["agency", "recruitment", "staffing", "headhunter"]

export function detectSegment(input: CreateLeadInput): LeadSegment {
	const emailDomain = input.email.split("@")[1]?.toLowerCase() ?? ""

	// Free email → talent (individual contributor / freelancer)
	if (FREE_EMAIL_DOMAINS.has(emailDomain)) {
		return "talent"
	}

	// Recruitment HR platform domain → agency
	if (AGENCY_EMAIL_DOMAINS.has(emailDomain)) {
		return "agency"
	}

	// "agency" hinted in leadSource (case-insensitive keyword match)
	const source = (input.leadSource ?? "").toLowerCase()
	if (AGENCY_KEYWORDS.some((kw) => source.includes(kw))) {
		return "agency"
	}

	// Missing website → talent
	if (!input.companyWebsite || input.companyWebsite.trim() === "") {
		return "talent"
	}

	// Corporate email + website → enterprise
	return "enterprise"
}
