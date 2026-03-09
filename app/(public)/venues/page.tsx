import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function VenuesListPage() {
    const venues = await ArchiveService.getVenues();

    return (
        <ArchiveLayout>
            <section className="mb-12">
                <h1 className="text-4xl font-black mb-4 border-b-4 border-slate-900 pb-2">Archival Venues</h1>
                <p className="text-lg text-slate-600 mb-8 max-w-2xl font-sans">
                    Historical stadiums and fields that have hosted games in the UK.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {venues.map((venue: any) => (
                        <div
                            key={venue.id}
                            className="p-6 bg-white border border-slate-200 shadow-sm"
                        >
                            {venue.coordinates ? (
                                <a
                                    href={`https://www.google.com/maps?q=${venue.coordinates.replace(/[()]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block"
                                >
                                    <h2 className="text-xl font-bold group-hover:text-blue-700 transition-colors">
                                        {venue.name} <span className="text-[10px] text-blue-500 uppercase font-sans">↗ Map</span>
                                    </h2>
                                </a>
                            ) : (
                                <h2 className="text-xl font-bold">{venue.name}</h2>
                            )}
                            <div className="text-sm text-slate-500 font-sans mt-2">
                                {venue.city || "Unknown City"}
                            </div>
                            <div className="text-xs text-slate-400 font-sans mt-1 italic">
                                {venue.address}
                            </div>
                        </div>
                    ))}

                    {(!venues || venues.length === 0) && (
                        <div className="col-span-full p-12 text-center bg-white border border-dashed border-slate-300 rounded">
                            <p className="text-slate-400 font-sans italic">No venues found in the database yet.</p>
                        </div>
                    )}
                </div>
            </section>
        </ArchiveLayout>
    );
}
