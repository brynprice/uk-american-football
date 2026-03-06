import Link from 'next/link';
import { ArchiveService } from '@/services/archive-service';
import ArchiveLayout from '@/components/archive/ArchiveLayout';
import H2HStats from '@/components/archive/H2HStats';

interface H2HPageProps {
    params: Promise<{
        id: string;
        opponentId: string;
    }>;
}

export default async function H2HPage({ params }: H2HPageProps) {
    const { id, opponentId } = await params;

    const [team1, team2, games] = await Promise.all([
        ArchiveService.getTeamHistory(id),
        ArchiveService.getTeamHistory(opponentId),
        ArchiveService.getH2HGames(id, opponentId)
    ]);

    return (
        <ArchiveLayout>
            <div className="mb-8 flex items-center gap-4">
                <Link
                    href={`/teams/${id}`}
                    className="text-xs font-black uppercase text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                    &larr; Back to {team1.name}
                </Link>
            </div>

            <section className="mb-12">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8 border-b-4 border-slate-900 pb-4">
                    <div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Rivalry Deep-Dive</h1>
                        <p className="text-slate-500 font-sans mt-1">
                            Historical series analysis between two clubs.
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-black uppercase text-slate-400">Total Games</div>
                        <div className="text-2xl font-black">{games.length}</div>
                    </div>
                </div>

                <H2HStats team1={team1} team2={team2} games={games} />
            </section>
        </ArchiveLayout>
    );
}
