import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center text-zinc-50">
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-zinc-500 text-sm mb-6">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-full bg-white text-zinc-950 text-sm font-medium hover:bg-zinc-200 transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
