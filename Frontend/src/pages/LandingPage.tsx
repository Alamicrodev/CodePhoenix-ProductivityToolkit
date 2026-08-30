import { Link } from "react-router"


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
            <a href="https://github.com/Alamicrodev/CodePhoenix-ProductivityToolkit/" className="inline-flex items-center gap-2 px-4 py-[9px] rounded-lg text-sm font-medium bg-panel-lt dark:bg-panel border border-border-lt dark:border-border text-ink-lt dark:text-ink hover:border-[#C7C9D1] dark:hover:border-[#3a3d49] transition-colors duration-150">View on GitHub</a>
            <a href="/schedule" className="inline-flex items-center gap-2 px-4 py-[9px] rounded-lg text-sm font-semibold bg-accent-lt dark:bg-accent text-white dark:text-bg hover:bg-accent-strong-lt dark:hover:bg-accent-strong transition-colors duration-150">Open App</a>
            </div>
        </div>
        </nav>


        
        
    </>
}