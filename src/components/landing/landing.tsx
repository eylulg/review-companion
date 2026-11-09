"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { ArrowRight } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import { SURFACE_CLASS } from "@/components/styles";
import { parsePullRequestUrl } from "@/lib/github";
import { MODEL_OPTIONS } from "@/lib/models";
import type { ReviewRequest } from "@/lib/types";
import { cx } from "@/utils/cx";

interface LandingProps {
    demo: boolean;
    defaultModel: string;
    onStart: (request: ReviewRequest) => void;
}

interface Example {
    url: string;
    repo: string;
    title: string;
    size: string;
}

export const URL_INPUT_ID = "pull-request-url";

/** Real public pull requests used as one-click examples. */
const EXAMPLES: Example[] = [
    { url: "https://github.com/vitejs/vite/pull/24041", repo: "vitejs/vite", title: "perf(css): import sass once instead of per file", size: "Small, 1 file" },
    { url: "https://github.com/vitejs/vite/pull/24044", repo: "vitejs/vite", title: "fix: escape ids in resolve virtual modules", size: "Medium, 5 files" },
    {
        url: "https://github.com/pmndrs/zustand/pull/3595",
        repo: "pmndrs/zustand",
        title: "fix(middleware): devtools action dispatching",
        size: "Large, 3 files",
    },
];

const INVALID_URL_MESSAGE = "Enter a pull request URL such as https://github.com/owner/repo/pull/123.";

export function Landing({ demo, defaultModel, onStart }: LandingProps) {
    const [url, setUrl] = useState("");
    const [model, setModel] = useState(defaultModel);
    const [includeSkipped, setIncludeSkipped] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function submit(value: string) {
        if (!parsePullRequestUrl(value)) {
            setError(INVALID_URL_MESSAGE);
            return;
        }
        setError(null);
        onStart({ url: value.trim(), model, includeSkipped });
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        submit(url);
    }

    function handleUrlChange(value: string) {
        setUrl(value);
        setError(null);
    }

    function handleModelChange(event: ChangeEvent<HTMLInputElement>) {
        const option = MODEL_OPTIONS.find((candidate) => candidate.id === event.target.value);
        if (option) setModel(option.id);
    }

    function handleExample(exampleUrl: string) {
        setUrl(exampleUrl);
        submit(exampleUrl);
    }

    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-12 md:px-6 md:py-20">
            <div className="flex flex-col gap-4">
                <h1 className="text-display-sm font-semibold text-primary md:text-display-md">Review a pull request with Claude</h1>
                <p className="text-lg text-tertiary">
                    Paste a public GitHub pull request. Claude reads the diff file by file and streams back findings with a severity, a line and, when the fix
                    is certain, a suggested change. Accept, dismiss or edit each one, then copy them as review comments.
                </p>
            </div>

            <form noValidate onSubmit={handleSubmit} className={cx(SURFACE_CLASS, "flex flex-col gap-6 rounded-2xl p-5 md:p-6")}>
                <Input
                    id={URL_INPUT_ID}
                    label="Pull request URL"
                    name="url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://github.com/owner/repo/pull/123"
                    value={url}
                    onChange={handleUrlChange}
                    isInvalid={error !== null}
                    hint={error ?? "Public repositories work without a token."}
                />

                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-sm font-medium text-secondary">Model</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {MODEL_OPTIONS.map((option) => (
                            <label
                                key={option.id}
                                className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-secondary has-checked:ring-2 has-checked:ring-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
                            >
                                <input
                                    type="radio"
                                    name="model"
                                    value={option.id}
                                    checked={model === option.id}
                                    onChange={handleModelChange}
                                    className="mt-1 size-4 accent-bg-brand-solid focus:outline-hidden"
                                />
                                <span className="flex flex-col">
                                    <span className="text-sm font-semibold text-primary">{option.label}</span>
                                    <span className="text-sm text-tertiary">{option.description}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                <Toggle
                    label="Include lockfiles, generated and deleted files"
                    hint="Skipped by default because they rarely need a human review. Binaries are always skipped."
                    isSelected={includeSkipped}
                    onChange={setIncludeSkipped}
                />

                <div>
                    <Button type="submit" size="lg" iconTrailing={ArrowRight}>
                        Start review
                    </Button>
                </div>
            </form>

            <section aria-labelledby="examples-heading" className="flex flex-col gap-3">
                <h2 id="examples-heading" className="text-md font-semibold text-primary">
                    Or try an example
                </h2>
                {demo && (
                    <p className="text-sm text-tertiary">
                        In demo mode every example, and any URL you paste, replays the saved review of a sample pull request.
                    </p>
                )}
                <ul className="grid gap-3 md:grid-cols-3">
                    {EXAMPLES.map((example) => (
                        <li key={example.url}>
                            <ExampleButton example={example} onSelect={handleExample} />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function ExampleButton({ example, onSelect }: { example: Example; onSelect: (url: string) => void }) {
    function handleClick() {
        onSelect(example.url);
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={cx(
                SURFACE_CLASS,
                "flex h-full w-full cursor-pointer flex-col items-start gap-1 p-4 text-left hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            )}
        >
            <span className="text-xs font-medium text-brand-secondary">Review {example.repo}</span>
            <span className="text-sm font-semibold text-primary">{example.title}</span>
            <span className="text-xs text-tertiary">{example.size}</span>
        </button>
    );
}
