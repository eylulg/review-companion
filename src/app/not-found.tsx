import Link from "next/link";

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4">
            <h1 className="text-display-xs font-semibold text-primary">Page not found</h1>
            <p className="text-md text-tertiary">There is nothing at this address.</p>
            <Link
                className="rounded-sm font-semibold text-brand-secondary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href="/"
            >
                Back to Review Companion
            </Link>
        </main>
    );
}
