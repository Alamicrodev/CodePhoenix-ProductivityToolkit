import { Link } from "react-router"
import img1 from '../../public/image_1.jpeg'


export default function LandingPage() {


    return <>
        <nav className="sticky top-0 z-20 bg-bg-lt/85 dark:bg-bg/85 backdrop-blur-md border-b border-border-soft-lt dark:border-border-soft transition-colors duration-150">
            <div className="flex items-center justify-between px-8 py-4 max-w-[1180px] mx-auto">
                <div className="flex items-center gap-2.5 font-bold text-[15px] tracking-tight">
                    <div className="w-[26px] h-[26px] rounded-[7px] bg-accent-lt dark:bg-accent text-white dark:text-bg flex items-center justify-center font-bold text-sm">F</div>
                    FlowManager
                </div>
                <div className="hidden md:flex gap-7 text-sm text-muted-lt dark:text-muted">
                    <a href="#modules" className="hover:text-ink-lt dark:hover:text-ink">Modules</a>
                    <a href="#cowork" className="hover:text-ink-lt dark:hover:text-ink">Cowork Rooms</a>
                    <a href="#stack" className="hover:text-ink-lt dark:hover:text-ink">Stack</a>
                </div>
                <div className="flex items-center gap-3.5">
                    <button id="themeToggle" type="button" aria-label="Toggle light and dark theme"
                        className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-lg bg-panel-lt dark:bg-panel border border-border-lt dark:border-border text-muted-lt dark:text-muted hover:text-ink-lt dark:hover:text-ink hover:border-[#C7C9D1] dark:hover:border-[#3a3d49] cursor-pointer flex-shrink-0 transition-colors duration-150">
                        <svg className="w-4 h-4 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>
                        <svg className="w-4 h-4 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    </button>
                    <Link to="https://github.com/Alamicrodev/CodePhoenix-ProductivityToolkit/" className="inline-flex items-center gap-2 px-4 py-[9px] rounded-lg text-sm font-medium bg-panel-lt dark:bg-panel border border-border-lt dark:border-border text-ink-lt dark:text-ink hover:border-[#C7C9D1] dark:hover:border-[#3a3d49] transition-colors duration-150">
                        <span> View on Github </span>
                    </Link>
                    <Link to="/schedule" className="inline-flex items-center gap-2 px-4 py-[9px] rounded-lg text-sm font-semibold bg-accent-lt dark:bg-accent text-white dark:text-bg hover:bg-accent-strong-lt dark:hover:bg-accent-strong transition-colors duration-150">
                        <span>Open App</span>
                    </Link>
                </div>
            </div>
        </nav>


        <section className="pt-24 pb-16 px-8 text-center">
            <div className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.08em] text-accent-strong-lt dark:text-accent-strong bg-[rgba(90,103,216,0.09)] dark:bg-[rgba(124,136,224,0.12)] border border-[rgba(90,103,216,0.2)] dark:border-[rgba(124,136,224,0.25)] px-3.5 py-1.5 rounded-full mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-success-lt dark:bg-success shadow-[0_0_0_3px_rgba(30,158,90,0.15)] dark:shadow-[0_0_0_3px_rgba(98,184,130,0.18)]"></span>
                CAPSTONE PROJECT &middot; CODE PHOENIX
            </div>
            <h1 className="text-[38px] md:text-[60px] leading-[1.06] font-bold tracking-[-0.03em] max-w-[780px] mx-auto mb-5">
                Your day, <span className="text-accent-strong-lt dark:text-accent-strong">assembled</span> &mdash; not managed.
            </h1>
            <p className="text-lg text-muted-lt dark:text-muted max-w-[560px] mx-auto mb-9 leading-relaxed">
                Tasks, habits and focus sessions share one brain, so the day plans itself &mdash; and focus is never a solo habit.
            </p>
            <div className="flex gap-3 justify-center mb-[72px] flex-wrap">
                <Link to="/schedule" className="inline-flex items-center gap-2 px-[22px] py-[11px] rounded-lg text-[14.5px] font-semibold bg-accent-lt dark:bg-accent text-white dark:text-bg hover:bg-accent-strong-lt dark:hover:bg-accent-strong transition-colors duration-150">
                    <span> See it in action </span>
                </Link>
                <Link to="#" className="inline-flex items-center gap-2 px-[22px] py-[11px] rounded-lg text-[14.5px] font-medium bg-panel-lt dark:bg-panel border border-border-lt dark:border-border text-ink-lt dark:text-ink hover:border-[#C7C9D1] dark:hover:border-[#3a3d49] transition-colors duration-150">
                    <span> Read More </span>
                </Link>
            </div>
            <div className="max-w-[980px] mx-auto rounded-xl2 border border-border-lt dark:border-border bg-panel-lt dark:bg-panel overflow-hidden shadow-hero-lt dark:shadow-hero transition-colors duration-150">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border-soft-lt dark:border-border-soft bg-bg-raised-lt dark:bg-bg-raised">
                    <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                </div>
                <img src={img1} alt="Hero Image" />
            </div>
        </section>




    </>
}