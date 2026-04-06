import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const AUTH = "?password=mergex-leadgen";

describe("LeadGen API", () => {
	it("rejects unauthenticated requests", async () => {
		const res = await SELF.fetch("https://example.com/searches");
		expect(res.status).toBe(401);
	});

	it("returns API info on root", async () => {
		const res = await SELF.fetch(`https://example.com/${AUTH}`);
		const body = await res.json<any>();
		expect(body.message).toBe("Mergex LeadGen API");
		expect(body.endpoints).toBeDefined();
	});

	it("saves and retrieves a search", async () => {
		// Save
		const saveRes = await SELF.fetch(`https://example.com/searches${AUTH}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				query: "restaurants in Chennai",
				mode: "fast",
				results: [
					{
						title: "Test Restaurant",
						cid: "123",
						stars: 4.5,
						reviews: 100,
						category: "Restaurant",
						address: "123 Main St",
						completePhoneNumber: "1234567890",
						url: "https://example.com",
					},
				],
			}),
		});
		expect(saveRes.status).toBe(201);
		const saved = await saveRes.json<any>();
		expect(saved.id).toBeDefined();
		expect(saved.resultsCount).toBe(1);

		// Get search + results
		const getRes = await SELF.fetch(`https://example.com/searches/${saved.id}${AUTH}`);
		const data = await getRes.json<any>();
		expect(data.search.query).toBe("restaurants in Chennai");
		expect(data.results).toHaveLength(1);
		expect(data.results[0].title).toBe("Test Restaurant");

		// Get results only
		const resultsRes = await SELF.fetch(`https://example.com/searches/${saved.id}/results${AUTH}`);
		const resultsData = await resultsRes.json<any>();
		expect(resultsData.results).toHaveLength(1);

		// Autocomplete
		const acRes = await SELF.fetch(`https://example.com/searches/autocomplete${AUTH}&q=rest`);
		const acData = await acRes.json<any>();
		expect(acData.suggestions).toContain("restaurants in Chennai");

		// List searches
		const listRes = await SELF.fetch(`https://example.com/searches${AUTH}`);
		const listData = await listRes.json<any>();
		expect(listData.searches.length).toBeGreaterThanOrEqual(1);
	});
});
