"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-zinc-50">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-zinc-500 text-sm mb-6 max-w-md">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-full bg-white text-zinc-950 text-sm font-medium hover:bg-zinc-200 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
