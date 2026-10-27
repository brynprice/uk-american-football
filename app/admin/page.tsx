import Link from "next/link";
import ArchiveLayout from "@/components/archive/ArchiveLayout";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import {
    getUserAccess,
    PERMISSION_METADATA,
    PermissionKey,
} from "@/lib/auth/permissions";

interface AdminCardItem {
    key: PermissionKey | "users";
    href: string;
    title: string;
    description: string;
    badge?: string;
    variant: "blue" | "dark" | "amber" | "emerald" | "white";
}

const ADMIN_CARDS: AdminCardItem[] = [
    {
        key: "gameday",
        href: "/admin/gameday",
        title: "Gameday Scoreboard",
        description:
            "Fast bulk score entry, walkovers, and postponements for weekly match days with instant standings calculation.",
        badge: "Live Season",
        variant: "blue",
    },
    {
        key: "poll",
        href: "/admin/poll",
        title: "Uniball Writer's Poll",
        description:
            "Pick and rank your Top 25 Uniball teams from tiered division standings with one-click assignment, drag-and-drop ordering, and consensus rankings.",
        badge: "Top 25 Ballot",
        variant: "dark",
    },
    {
        key: "users",
        href: "/admin/users",
        title: "User & Permissions Manager",
        description:
            "Create accounts for Poll Voters or Contributors and assign granular permissions to individual admin tools.",
        badge: "Super Admin",
        variant: "emerald",
    },
    {
        key: "predictions",
        href: "/admin/predictions",
        title: "Score Predictor",
        description:
            "Predict future game results based on historical H2H data, weekly slate generator, and model calibration analysis.",
        variant: "white",
    },
    {
        key: "proposals",
        href: "/admin/proposals",
        title: "Review Proposals",
        description:
            "Approve or reject game update suggestions from the public.",
        variant: "amber",
    },
    {
        key: "add_game",
        href: "/admin/add-game",
        title: "Add Game Record",
        description:
            "Manually enter historical game data, including scores, venues, and coaching staff.",
        variant: "white",
    },
    {
        key: "walkovers",
        href: "/admin/walkovers",
        title: "Walkover Manager",
        description:
            "Resolve awarded games with missing scores. Award forfeit wins (1-0 or 0-1) or clean up duplicates.",
        variant: "white",
    },
    {
        key: "set_coach",
        href: "/admin/set-coach",
        title: "Coaching Manager",
        description:
            "Easily set head coaches for teams by season or individual games.",
        variant: "white",
    },
    {
        key: "anomalies",
        href: "/admin/anomalies",
        title: "Anomalies Manager",
        description:
            "Identify and resolve inconsistent game data, update scores, or delete invalid entries.",
        variant: "white",
    },
    {
        key: "game_counts",
        href: "/admin/game-counts",
        title: "Game Count Validator",
        description:
            "Review phases where teams have played more or fewer games than expected.",
        variant: "white",
    },
    {
        key: "champions",
        href: "/admin/champions",
        title: "Divisional Champions",
        description:
            "Designate official division and conference champions for each season phase.",
        variant: "white",
    },
];

export default async function AdminDashboard({
    searchParams,
}: {
    searchParams?: Promise<{ denied?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const access = getUserAccess(user);
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const deniedKey = resolvedSearchParams?.denied;

    const visibleCards = ADMIN_CARDS.filter((card) => {
        if (card.key === "users") {
            return access.isAdmin;
        }
        return access.isAdmin || access.permissions.includes(card.key);
    });

    const getCardClasses = (variant: AdminCardItem["variant"]) => {
        switch (variant) {
            case "blue":
                return {
                    card: "group bg-blue-600 text-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all",
                    badge: "bg-amber-400 text-slate-900",
                    title: "text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-amber-300",
                    desc: "text-blue-100 font-sans leading-relaxed",
                };
            case "dark":
                return {
                    card: "group bg-slate-900 text-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(59,130,246,1)] transition-all",
                    badge: "bg-amber-400 text-slate-950",
                    title: "text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-amber-400",
                    desc: "text-slate-300 font-sans leading-relaxed",
                };
            case "emerald":
                return {
                    card: "group bg-emerald-700 text-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all",
                    badge: "bg-amber-400 text-slate-950",
                    title: "text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-amber-300",
                    desc: "text-emerald-50 font-sans leading-relaxed",
                };
            case "amber":
                return {
                    card: "group bg-amber-400 text-slate-900 border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all",
                    badge: "bg-slate-900 text-white",
                    title: "text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-amber-900",
                    desc: "font-sans leading-relaxed font-bold",
                };
            default:
                return {
                    card: "group bg-white border-2 border-slate-900 p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all",
                    badge: "bg-slate-900 text-white",
                    title: "text-2xl font-black mb-4 uppercase tracking-tight group-hover:text-blue-700",
                    desc: "text-slate-600 font-sans leading-relaxed",
                };
        }
    };

    const deniedLabel =
        deniedKey === "admin_only"
            ? "Super Admin Tools"
            : deniedKey && PERMISSION_METADATA[deniedKey as PermissionKey]
            ? PERMISSION_METADATA[deniedKey as PermissionKey].label
            : deniedKey;

    return (
        <ArchiveLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-black uppercase italic tracking-tighter">
                            {access.isAdmin ? "Admin Dashboard" : "Contributor Portal"}
                        </h1>
                        <span
                            className={`text-xs font-sans font-black uppercase px-2.5 py-1 border-2 border-slate-900 ${
                                access.isAdmin
                                    ? "bg-amber-400 text-slate-950"
                                    : "bg-blue-600 text-white"
                            }`}
                        >
                            {access.isAdmin ? "Super Admin" : "Contributor"}
                        </span>
                    </div>
                    <p className="text-slate-500 font-sans">
                        {access.isAdmin
                            ? "Manage the historical archive, live scores, and contributor permissions."
                            : "Access your assigned Britball tools below."}
                    </p>
                </div>

                {access.email && (
                    <div className="flex items-center gap-4 bg-white border-2 border-slate-900 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="font-sans text-right">
                            <p className="text-[10px] uppercase font-black text-slate-400 leading-none mb-1">
                                Logged in as
                            </p>
                            <p className="font-bold text-sm leading-none">{access.email}</p>
                        </div>
                        <form action={signOut}>
                            <button
                                type="submit"
                                className="bg-slate-900 text-white text-[10px] uppercase font-black px-3 py-2 hover:bg-red-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                            >
                                Sign Out
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {deniedLabel && (
                <div className="mb-8 bg-rose-50 border-2 border-rose-600 p-4 font-sans text-sm text-rose-900 shadow-[4px_4px_0px_0px_rgba(225,29,72,1)] flex items-center justify-between">
                    <div>
                        <span className="font-black uppercase mr-2">Access Restricted:</span>
                        Your account does not currently have permission to access{" "}
                        <strong>{deniedLabel}</strong>.
                    </div>
                </div>
            )}

            {visibleCards.length === 0 ? (
                <div className="bg-white border-2 border-slate-900 p-12 text-center font-sans shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                    <h2 className="text-xl font-black uppercase mb-2">
                        No Tools Assigned Yet
                    </h2>
                    <p className="text-slate-600 text-sm">
                        Your account is active, but no feature permissions have been assigned yet. Please ask an administrator to enable your tools in the User &amp; Permissions Manager.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {visibleCards.map((card) => {
                        const styles = getCardClasses(card.variant);
                        return (
                            <Link key={card.key} href={card.href} className={styles.card}>
                                {card.badge && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <span
                                            className={`${styles.badge} text-[10px] font-sans font-black uppercase px-2 py-0.5 rounded`}
                                        >
                                            {card.badge}
                                        </span>
                                    </div>
                                )}
                                <h2 className={styles.title}>{card.title} &rarr;</h2>
                                <p className={styles.desc}>{card.description}</p>
                            </Link>
                        );
                    })}
                </div>
            )}
        </ArchiveLayout>
    );
}
