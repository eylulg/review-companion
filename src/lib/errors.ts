import type { ReviewErrorCode } from "./types";

/** An error with a stable code that the route sends to the client as an `error` event. */
export class ReviewError extends Error {
    readonly code: ReviewErrorCode;

    constructor(code: ReviewErrorCode, message: string) {
        super(message);
        this.name = "ReviewError";
        this.code = code;
    }
}
