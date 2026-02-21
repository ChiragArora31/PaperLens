'use client';

export default function LoadingSkeleton() {
    return (
        <div className="min-h-screen gradient-bg noise-overlay">
            <div className="relative z-10">
                {/* Nav skeleton */}
                <div
                    className="glass-strong border-b px-6 py-4"
                    style={{ borderColor: 'hsl(var(--border))' }}
                >
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="skeleton h-5 w-28 rounded-lg" />
                        <div className="hidden md:flex gap-2">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="skeleton h-7 w-20 rounded-xl" />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 pt-10">
                    {/* Title */}
                    <div className="mb-8">
                        <div className="skeleton h-8 w-3/4 rounded-lg mb-3" />
                        <div className="skeleton h-5 w-1/2 rounded-lg mb-4" />
                        <div className="flex gap-3">
                            <div className="skeleton h-7 w-24 rounded-full" />
                            <div className="skeleton h-7 w-20 rounded-full" />
                            <div className="skeleton h-7 w-28 rounded-full" />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="skeleton h-px w-full mb-10 rounded-full" />

                    {/* TL;DR section */}
                    <div className="mb-14">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="skeleton w-10 h-10 rounded-2xl" />
                            <div>
                                <div className="skeleton h-5 w-16 rounded-lg mb-1" />
                                <div className="skeleton h-3 w-28 rounded-lg" />
                            </div>
                        </div>
                        <div
                            className="rounded-2xl p-6 mb-4"
                            style={{
                                background: 'hsl(var(--bg-card))',
                                border: '1px solid hsl(var(--border))',
                            }}
                        >
                            <div className="skeleton h-4 w-full rounded-lg mb-2" />
                            <div className="skeleton h-4 w-5/6 rounded-lg" />
                        </div>
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex gap-3 items-start">
                                    <div className="skeleton w-5 h-5 rounded-lg flex-shrink-0" />
                                    <div className="skeleton h-4 w-full rounded-lg" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Explanations */}
                    <div className="mb-14">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="skeleton w-10 h-10 rounded-2xl" />
                            <div>
                                <div className="skeleton h-5 w-40 rounded-lg mb-1" />
                                <div className="skeleton h-3 w-32 rounded-lg" />
                            </div>
                        </div>
                        <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: 'hsl(var(--bg-tertiary))' }}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex-1 skeleton h-10 rounded-xl" />
                            ))}
                        </div>
                        <div
                            className="rounded-2xl p-6"
                            style={{
                                background: 'hsl(var(--bg-card))',
                                border: '1px solid hsl(var(--border))',
                            }}
                        >
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="skeleton h-4 rounded-lg mb-3"
                                    style={{ width: `${85 - i * 5}%` }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Concepts */}
                    <div className="mb-14">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="skeleton w-10 h-10 rounded-2xl" />
                            <div>
                                <div className="skeleton h-5 w-32 rounded-lg mb-1" />
                                <div className="skeleton h-3 w-36 rounded-lg" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="rounded-2xl p-4 flex items-center gap-4"
                                    style={{
                                        background: 'hsl(var(--bg-card))',
                                        border: '1px solid hsl(var(--border))',
                                    }}
                                >
                                    <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0" />
                                    <div className="skeleton h-4 flex-1 rounded-lg" />
                                    <div className="skeleton w-4 h-4 rounded flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
