import Link from 'next/link';

export default function ArchiveLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-serif">
            <header className="border-b bg-white sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <Link href="/" className="text-2xl font-bold tracking-tight hover:text-blue-700 transition-colors">
                        Britball Archive
                    </Link>
                    <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm uppercase tracking-widest font-sans font-medium">
                        <Link href="/about" className="hover:text-blue-700">About</Link>
                        <Link href="/competitions" className="hover:text-blue-700">Competitions</Link>
                        <Link href="/teams" className="hover:text-blue-700">Teams</Link>
                        <Link href="/timeline" className="hover:text-blue-700">Timeline</Link>
                        <Link href="/people" className="hover:text-blue-700">People</Link>
                        <Link href="/scorigami" className="hover:text-blue-700">Scorigami</Link>
                        <Link href="/propose-game" className="px-3 py-1 bg-slate-900 text-white rounded hover:bg-blue-700 transition-colors">Contribute</Link>
                    </nav>
                </div>
            </header>
            <main className="container mx-auto px-4 py-8 max-w-5xl">
                {children}
            </main>
            <footer className="border-t bg-white mt-12 py-8">
                <div className="container mx-auto px-4 text-center text-slate-500 text-sm font-sans">
                    <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mb-3">
                        <Link href="/about" className="text-slate-700 font-semibold hover:text-blue-700">About the Project</Link>
                        <span>&bull;</span>
                        <Link href="/timeline" className="text-slate-700 font-semibold hover:text-blue-700">Uniball Timeline</Link>
                        <span>&bull;</span>
                        <Link href="/propose-game" className="text-slate-700 font-semibold hover:text-blue-700">Contribute Data</Link>
                        <span>&bull;</span>
                        <a href="mailto:ukaffootballproject@gmail.com" className="text-slate-700 font-semibold hover:text-blue-700">Contact</a>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Britball Archive</p>
                    <p className="mt-1 italic">Preserving the history of American Football in Great Britain — founded by Bryn Price.</p>
                </div>
            </footer>
        </div>
    );
}
