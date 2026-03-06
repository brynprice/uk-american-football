import Link from 'next/link';

export default function ArchiveLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-serif">
            <header className="border-b bg-white sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <Link href="/" className="text-2xl font-bold tracking-tight hover:text-blue-700 transition-colors">
                        UK American Football Archive
                    </Link>
                    <nav className="space-x-6 text-sm uppercase tracking-widest font-sans font-medium">
                        <Link href="/" className="hover:text-blue-700">Competitions</Link>
                        <Link href="/teams" className="hover:text-blue-700">Teams</Link>
                        <Link href="/people" className="hover:text-blue-700">People</Link>
                        <Link href="/venues" className="hover:text-blue-700">Venues</Link>
                        <Link href="/scorigami" className="hover:text-blue-700">Scorigami</Link>
                    </nav>
                </div>
            </header>
            <main className="container mx-auto px-4 py-8 max-w-5xl">
                {children}
            </main>
            <footer className="border-t bg-white mt-12 py-8">
                <div className="container mx-auto px-4 text-center text-slate-500 text-sm font-sans">
                    <p>&copy; {new Date().getFullYear()} British American Football Historical Archive</p>
                    <p className="mt-2 italic">Preserving the history of the game in the United Kingdom.</p>
                </div>
            </footer>
        </div>
    );
}
