"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" tabIndex={-1} className="route-status"><h1>Something interrupted this page.</h1><p>Your request could not be completed. Try again or return home.</p><button className="primary-action" onClick={reset}>Try again</button><Link href="/">Back to AIsathi</Link></main>;
}
