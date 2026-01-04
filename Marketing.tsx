import React, { useState, useEffect } from 'react';
import {
    Check,
    Zap,
    UploadCloud,
    Layers,
    Folder,
    FileText,
    FileCheck,
    AlertCircle,
    MoreHorizontal
} from 'lucide-react';
import { Logo, Button, Chip, SectionHeader } from './src/components/ui';

// --- Navbar ---
const Navbar = ({ onLogin, onLogout, isLoggedIn }: { onLogin: () => void; onLogout?: () => void; isLoggedIn?: boolean }) => (
    <nav className="glass-nav fixed top-0 left-0 right-0 z-50 h-16 flex items-center">
        <div className="container flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
                <Logo />
            </div>

            <div className="hidden md:flex gap-8 items-center text-sm font-medium text-gray-500">
                <a href="#features" className="hover:text-black transition-colors">Platform</a>
                <a href="#workflow" className="hover:text-black transition-colors">How it Works</a>
                <a href="#pricing" className="hover:text-black transition-colors">Pricing</a>
            </div>

            <div className="flex items-center gap-3">
                {isLoggedIn ? (
                    <Button variant="ghost" onClick={onLogout}>Sign out</Button>
                ) : (
                    <Button variant="ghost" onClick={onLogin}>Log in</Button>
                )}
                <Button variant="primary" onClick={onLogin}>Book Demo</Button>
            </div>
        </div>
    </nav>
);

// --- Hero Section ---
const Hero = ({ onLogin }: { onLogin: () => void }) => (
    <section className="pt-32 pb-20 overflow-hidden relative">
        <div className="absolute inset-0 dash-grid-bg opacity-40 pointer-events-none"></div>
        <div className="container text-center flex flex-col items-center relative z-10">
            <div className="reveal inline-flex items-center gap-2 mb-8">
                <Chip active>New: Bulk CSV Processing Live</Chip>
            </div>
            <h1 className="reveal text-5xl md:text-8xl font-bold text-gray-900 mb-6 tracking-tighter max-w-5xl mx-auto leading-[0.95]">
                The High-Velocity Engine for <br />
                <span className="text-gray-400">Canadian Work Permits.</span>
            </h1>
            <p className="reveal text-lg md:text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed font-medium">
                Stop drowning in PDFs. Automate LMIAs, validate wage compliance, and generate error-free application packages in minutes—not hours.
            </p>
            <div className="reveal flex flex-col md:flex-row gap-4 mb-20">
                <Button variant="primary" size="lg" onClick={onLogin} className="h-14 px-8 text-lg">
                    Start for Free <span className="ml-2 opacity-50 text-sm font-normal">(No credit card)</span>
                </Button>
                <Button variant="white" size="lg" onClick={onLogin} className="h-14 px-8 text-lg">
                    See the ROI
                </Button>
            </div>
            <HeroGraphic />
        </div>
    </section>
);

const HeroGraphic = () => (
    <div className="reveal w-full max-w-5xl relative">
        <div className="relative bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden hover:scale-[1.01] transition-transform duration-700 ease-out hover:shadow-3xl">
            <div className="h-10 border-b border-gray-100 flex items-center px-4 justify-between bg-gray-50">
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                </div>
                <div className="text-xs font-mono text-gray-400">BATCH_PROCESS_V2.1</div>
                <div className="w-16"></div>
            </div>
            <div className="p-1 min-h-[400px] flex">
                <div className="w-64 border-r border-gray-100 p-4 hidden md:block bg-gray-50/50">
                    <div className="space-y-1 mb-6">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Workspace</div>
                        <div className="px-2 py-1.5 bg-white border border-gray-200 rounded text-sm font-medium flex items-center gap-2 shadow-sm">
                            <Folder size={14} className="text-black" /> Tech_Cohort_A
                        </div>
                        <div className="px-2 py-1.5 text-gray-500 rounded text-sm font-medium flex items-center gap-2">
                            <Folder size={14} /> Nurses_Batch_22
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-6 md:p-8 bg-white flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-bold">Processing Cohort: Software Engineers</h3>
                            <p className="text-sm text-gray-500 font-mono mt-1">NOC 21231 • Toronto, ON • 15 Applicants</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-2xl font-bold font-mono">14/15</div>
                                <div className="text-xs text-green-600 font-bold uppercase tracking-wider">Validated</div>
                            </div>
                            <div className="w-12 h-12 relative">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                    <path className="text-[var(--accent)]" strokeDasharray="93, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                        <div className="border border-dashed border-gray-200 rounded-lg p-4 flex flex-col gap-3 bg-gray-50/30">
                            <div className="text-xs font-bold text-gray-400 uppercase">Input Stream</div>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white border border-gray-200 p-3 rounded shadow-sm flex items-center gap-3 opacity-60">
                                    <FileText size={16} className="text-gray-400" />
                                    <div className="h-2 w-16 bg-gray-200 rounded"></div>
                                </div>
                            ))}
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center relative overflow-hidden bg-[var(--bg-primary)]">
                            <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-lg relative z-10">
                                <Zap size={24} className="text-[var(--accent)]" fill="currentColor" />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <span className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded">Wage_Check</span>
                                <span className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded">Form_Gen</span>
                            </div>
                        </div>
                        <div className="border border-green-100 rounded-lg p-4 flex flex-col gap-3 bg-green-50/20">
                            <div className="text-xs font-bold text-green-700 uppercase">Output</div>
                            <div className="bg-white border border-green-200 p-3 rounded shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileCheck size={16} className="text-green-500" />
                                    <span className="font-mono text-xs">Pkg_J_Doe.pdf</span>
                                </div>
                                <Check size={14} className="text-green-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="mt-16 flex flex-col items-center gap-6">
            <p className="font-mono text-xs text-gray-400 uppercase tracking-widest">Trusted by high-volume agencies</p>
            <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale mix-blend-multiply">
                {['GlobalMigrate', 'VisaPlace', 'LawPoint', 'BorderLink'].map((logo, i) => (
                    <div key={i} className="text-lg font-bold font-serif text-gray-800">{logo}</div>
                ))}
            </div>
        </div>
    </div>
);

// --- Comparison Section ---
const ComparisonSection = () => {
    const [sliderVal, setSliderVal] = useState(50);

    return (
        <section className="py-24 bg-white border-t border-gray-100">
            <div className="container">
                <div className="text-center mb-16">
                    <SectionHeader title="Chaos vs. Control" center />
                    <div className="flex justify-center gap-8 text-sm font-medium">
                        <div className="text-gray-400">The Old Way</div>
                        <div className="text-[var(--accent)]">The LMIAFlow Way</div>
                    </div>
                </div>
                <div className="relative w-full max-w-6xl mx-auto h-[500px] rounded-xl overflow-hidden border border-gray-200 select-none shadow-2xl">
                    <div className="absolute inset-0 bg-[#FFF5F5] flex">
                        <div className="w-1/2 p-12 pr-24 flex flex-col justify-center">
                            <h3 className="text-red-500 font-mono text-sm uppercase tracking-widest mb-6 font-bold">Manual Chaos</h3>
                            <p className="text-3xl font-bold mb-4 text-gray-900 leading-tight">45 minutes of copy-pasting.</p>
                            <div className="space-y-3 opacity-75 mt-4">
                                <div className="flex items-center gap-3 text-red-700 bg-red-100/50 p-3 rounded border border-red-200">
                                    <AlertCircle size={18} /> Error: Wage below median
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-white border-r border-gray-900 overflow-hidden" style={{ width: `${sliderVal}%` }}>
                        <div className="absolute inset-0 w-full max-w-6xl mx-auto h-[500px] flex justify-end">
                            <div className="w-1/2 p-12 pl-24 flex flex-col justify-center bg-white h-full relative">
                                <div className="absolute inset-0 dash-grid-bg opacity-30 pointer-events-none"></div>
                                <div className="relative z-10">
                                    <h3 className="text-[var(--accent)] font-mono text-sm uppercase tracking-widest mb-6 font-bold">Industrial Control</h3>
                                    <p className="text-3xl font-bold mb-4 text-gray-900 leading-tight">Upload CSV. Validate. Done.</p>
                                    <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm mt-4">
                                        <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
                                            <span className="font-mono text-xs text-gray-500">STATUS_CHECK</span>
                                            <span className="font-mono text-xs text-green-600">ALL_SYSTEMS_GO</span>
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-center gap-2 mb-2"><Check size={14} className="text-green-500" /> <span className="text-sm">NOC Match: Valid</span></div>
                                            <div className="flex items-center gap-2"><Check size={14} className="text-green-500" /> <span className="text-sm">Wage: Above Median</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-y-0 w-1 bg-black cursor-ew-resize hover:scale-110 transition-transform z-30" style={{ left: `${sliderVal}%` }} onMouseDown={(e) => {
                        const container = e.currentTarget.parentElement;
                        if (!container) return;
                        const rect = container.getBoundingClientRect();

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                            const x = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
                            setSliderVal((x / rect.width) * 100);
                        };
                        const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-black rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                            <MoreHorizontal size={16} className="text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

// --- Features Section ---
const FeaturesSection = () => (
    <section className="py-24 bg-[var(--bg-primary)]" id="features">
        <div className="container">
            <SectionHeader title="The Industrial Wedge." center />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {[
                    { title: "Smart Intake", desc: "Type a NOC code. We pull live wage data. Flag errors before you start.", icon: Zap },
                    { title: "Zero-Friction", desc: "Send secure magic links. Clients upload from phone. OCR extracts data.", icon: UploadCloud },
                    { title: "Auto-Assembly", desc: "One click merges, compresses, and renames files to IRCC standards.", icon: Layers }
                ].map((f, i) => (
                    <div key={i} className="bg-white p-8 rounded-xl border border-gray-200 hover:border-black transition-colors">
                        <f.icon size={32} className="mb-6 text-gray-800" />
                        <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                        <p className="text-gray-600 leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

// --- Pricing Section ---
const PricingSection = ({ onLogin }: { onLogin: () => void }) => (
    <section className="py-24 bg-white border-t border-gray-100" id="pricing">
        <div className="container">
            <div className="text-center mb-16">
                <h2 className="text-4xl mb-4 font-bold">Volume Pricing.</h2>
                <p className="text-gray-500">Stop paying for seats. Pay for performance.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="p-8 border border-gray-200 rounded-xl">
                    <h3 className="font-bold text-lg mb-2">Starter</h3>
                    <div className="text-4xl font-bold mb-6">$0<span className="text-sm font-normal text-gray-500">/mo</span></div>
                    <ul className="space-y-4 mb-8 text-sm">
                        <li className="flex gap-2"><Check size={16} /> Pay per application</li>
                        <li className="flex gap-2"><Check size={16} /> All forms included</li>
                    </ul>
                    <Button variant="white" onClick={onLogin} className="w-full">Start for Free</Button>
                </div>
                <div className="p-8 border-2 border-[var(--accent)] rounded-xl relative bg-orange-50/10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--accent)] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Best Value</div>
                    <h3 className="font-bold text-lg mb-2">Agency</h3>
                    <div className="text-4xl font-bold mb-6">$199<span className="text-sm font-normal text-gray-500">/mo</span></div>
                    <ul className="space-y-4 mb-8 text-sm">
                        <li className="flex gap-2"><Check size={16} /> 15 apps included</li>
                        <li className="flex gap-2"><Check size={16} /> Bulk CSV Import</li>
                    </ul>
                    <Button variant="secondary" onClick={onLogin} className="w-full">Start Trial</Button>
                </div>
                <div className="p-8 border border-gray-200 rounded-xl bg-gray-50">
                    <h3 className="font-bold text-lg mb-2">Enterprise</h3>
                    <div className="text-4xl font-bold mb-6">Custom</div>
                    <ul className="space-y-4 mb-8 text-sm text-gray-600">
                        <li className="flex gap-2"><Check size={16} /> Unlimited Volume</li>
                        <li className="flex gap-2"><Check size={16} /> API Access</li>
                    </ul>
                    <Button variant="white" className="w-full">Contact Sales</Button>
                </div>
            </div>
        </div>
    </section>
);

const Footer = () => (
    <footer className="py-20 bg-black text-white">
        <div className="container">
            <h2 className="text-5xl md:text-7xl font-bold mb-12 tracking-tight">Ready to fix your workflow?</h2>
            <div className="flex flex-col md:flex-row justify-between items-start gap-12 border-t border-gray-800 pt-12">
                <div>
                    <div className="font-bold text-2xl mb-4">LMIAFlow</div>
                    <p className="text-gray-500">Montreal, QC • Data Sovereignty Guaranteed</p>
                </div>
                <div className="flex gap-12 text-sm text-gray-400">
                    <div className="flex flex-col gap-4">
                        <span className="text-white font-bold">Product</span>
                        <a href="#">Features</a>
                        <a href="#">Security</a>
                    </div>
                    <div className="flex flex-col gap-4">
                        <span className="text-white font-bold">Legal</span>
                        <a href="#">Privacy</a>
                        <a href="#">Terms</a>
                    </div>
                </div>
            </div>
        </div>
    </footer>
);

export const MarketingPage = ({ onLogin, onLogout, isLoggedIn }: { onLogin: () => void; onLogout?: () => void; isLoggedIn?: boolean }) => {
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) entry.target.classList.add('active');
                });
            },
            { threshold: 0.1 }
        );
        document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <Navbar onLogin={onLogin} onLogout={onLogout} isLoggedIn={isLoggedIn} />
            <Hero onLogin={onLogin} />
            <ComparisonSection />
            <FeaturesSection />
            <PricingSection onLogin={onLogin} />
            <Footer />
        </>
    );
};
