import type { CompanyResearchResult } from "#/application/research/research-company.ts"
import type { Lead } from "#/domain/lead/lead.ts"

/**
 * Builds a synthetic "company profile" for talent-segment leads
 * that don't have a company website to scrape.
 *
 * The profile is constructed from lead metadata (name, email, pain points, etc.)
 * so the downstream behavior-analysis and email-generation steps still get
 * meaningful context to work with.
 */
export function buildTalentResearchContext(lead: Lead): CompanyResearchResult {
	const profileParts: string[] = [
		"=== Talent Lead Profile ===",
		"",
		`Name: ${lead.fullName}`,
		`Email: ${lead.email}`,
		`Company: ${lead.companyName}`,
	]

	if (lead.companyWebsite) {
		profileParts.push(`Website: ${lead.companyWebsite}`)
	}

	if (lead.linkedinUrl) {
		profileParts.push(`LinkedIn: ${lead.linkedinUrl}`)
	}

	if (lead.painPoints) {
		profileParts.push(`Pain Points: ${lead.painPoints}`)
	}

	if (lead.companyIndustry) {
		profileParts.push(`Industry: ${lead.companyIndustry}`)
	}

	if (lead.companySize) {
		profileParts.push(`Company Size: ${lead.companySize}`)
	}

	if (lead.country) {
		profileParts.push(`Country: ${lead.country}`)
	}

	if (lead.language) {
		profileParts.push(`Preferred Language: ${lead.language}`)
	}

	profileParts.push("")
	profileParts.push(
		"Context: This is an individual talent/professional seeking services or opportunities.",
	)
	profileParts.push(
		"Note: No company website available. Personalize based on lead profile data above.",
	)

	const companyProfile = profileParts.join("\n")

	return {
		rawMarkdown: "",
		metadata: {},
		websiteAnalysis: {
			brandName: lead.companyName,
			tagline: "",
			industryCategory: lead.companyIndustry ?? "Individual/Freelance",
			keyOfferings: "",
			valueProposition: "",
			targetAudience: "Individual professional",
			callsToAction: "",
		},
		companyProfile,
		linkedinProfile: null,
	}
}
