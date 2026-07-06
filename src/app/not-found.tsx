import Link from 'next/link'
import { ArrowRight, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#04130d] text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-full border border-[#3ddf84]/40 bg-[#3ddf84]/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-[#7cffb0]">
          404 · Page not found
        </div>
        <h1 className="mt-8 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
          This Talk Wagon page does not exist.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#b8d8cc] sm:text-lg">
          The link may be old, mistyped, or moved. Use the dashboard if you are
          managing CRM work, or return to the public home page.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3ddf84] px-6 py-3 text-sm font-bold text-[#04130d] transition hover:bg-[#5ce99a]"
          >
            <Home className="h-4 w-4" />
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#3ddf84]/35 px-6 py-3 text-sm font-bold text-[#dfffee] transition hover:border-[#3ddf84]/70 hover:bg-[#3ddf84]/10"
          >
            Go to home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}
