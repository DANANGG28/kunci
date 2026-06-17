import { describe, expect, it } from "vitest"
import type { CreateLeadInput } from "#/domain/lead/lead.ts"
import { detectSegment } from "./detect-segment.ts"

function makeInput(overrides: Partial<CreateLeadInput> = {}): CreateLeadInput {
	return {
		fullName: "Test User",
		email: "test@company.com",
		companyName: "Test Corp",
		companyWebsite: "https://company.com",
		...overrides,
	}
}

describe("detectSegment", () => {
	// ── Talent detection via personal email domains ──

	it("returns 'talent' for gmail.com email", () => {
		expect(detectSegment(makeInput({ email: "user@gmail.com" }))).toBe("talent")
	})

	it("returns 'talent' for yahoo.com email", () => {
		expect(detectSegment(makeInput({ email: "user@yahoo.com" }))).toBe("talent")
	})

	it("returns 'talent' for hotmail.com email", () => {
		expect(detectSegment(makeInput({ email: "user@hotmail.com" }))).toBe(
			"talent",
		)
	})

	it("returns 'talent' for personal email regardless of case", () => {
		expect(detectSegment(makeInput({ email: "User@GMAIL.COM" }))).toBe("talent")
	})

	// ── Talent detection via missing website ──

	it("returns 'talent' when companyWebsite is undefined", () => {
		expect(
			detectSegment(
				makeInput({
					email: "user@customdomain.id",
					companyWebsite: undefined,
				}),
			),
		).toBe("talent")
	})

	it("returns 'talent' when companyWebsite is empty string", () => {
		expect(
			detectSegment(
				makeInput({ email: "user@customdomain.id", companyWebsite: "" }),
			),
		).toBe("talent")
	})

	it("returns 'talent' when companyWebsite is whitespace-only", () => {
		expect(
			detectSegment(
				makeInput({ email: "user@customdomain.id", companyWebsite: "   " }),
			),
		).toBe("talent")
	})

	// ── Enterprise detection ──

	it("returns 'enterprise' for corporate email with valid website", () => {
		expect(
			detectSegment(
				makeInput({
					email: "budi@cosulagi.id",
					companyWebsite: "https://cosulagi.id",
				}),
			),
		).toBe("enterprise")
	})

	it("returns 'enterprise' for .sg domain with website", () => {
		expect(
			detectSegment(
				makeInput({
					email: "john@acme.sg",
					companyWebsite: "https://acme.sg",
				}),
			),
		).toBe("enterprise")
	})

	// ── Edge cases ──

	it("returns 'enterprise' for unknown email provider with website", () => {
		expect(
			detectSegment(
				makeInput({
					email: "user@protonmail.com",
					companyWebsite: "https://example.com",
				}),
			),
		).toBe("enterprise")
	})

	it("handles email without @ gracefully (falls through to enterprise)", () => {
		// emailDomain will be undefined, ?? '' won't match personal list
		// companyWebsite is present, so enterprise
		expect(
			detectSegment(
				makeInput({
					email: "invalid-email",
					companyWebsite: "https://example.com",
				}),
			),
		).toBe("enterprise")
	})
})
