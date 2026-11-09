import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter } from "../rate-limit";

describe("createRateLimiter", () => {
    it("allows a fixed number of requests per key and window", () => {
        let time = 0;
        const check = createRateLimiter(2, 1000, () => time);

        const results = [check("a").allowed, check("a").allowed, check("a"), check("b").allowed];
        time = 1000;
        results.push(check("a").allowed);

        expect(results).toEqual([true, true, { allowed: false, remaining: 0, retryAfterSeconds: 1 }, true, true]);
    });
});

describe("clientIp", () => {
    it.each([
        [{ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }, "1.2.3.4"],
        [{ "x-real-ip": "5.6.7.8" }, "5.6.7.8"],
        [{}, "unknown"],
    ])("reads %o", (headers, expected) => {
        expect(clientIp(new Headers(headers))).toBe(expected);
    });
});
