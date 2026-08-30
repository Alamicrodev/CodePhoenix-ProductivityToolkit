import { Link } from "react-router"


export default function LandingPage() {


    return <>
        <nav>
            <div className="nav-inner">
                <div className="brand">
                    <div className="brand-mark">F</div>
                    FlowManager
                </div>
                <div className="nav-links">
                    <a href="#modules">Modules</a>
                    <a href="#cowork">Cowork Rooms</a>
                    <a href="#stack">Stack</a>
                </div>
                <div className="nav-cta">
                    <button className="theme-toggle" id="themeToggle" aria-label="Toggle light and dark theme" type="button">
                        <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>
                        <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    </button>
                    <a href="https://github.com/Alamicrodev/CodePhoenix-ProductivityToolkit/" className="btn btn-ghost">View on GitHub</a>
                    <Link to="/schedule" className="btn btn-primary">
                        <span>Open App</span>
                    </Link>
                </div>
            </div>
        </nav>


        <section className="hero">
            <div className="eyebrow"><span className="dot-live"></span>CAPSTONE PROJECT &middot; CODE PHOENIX</div>
            <h1 className="headline">Your day, <span className="accent-word">assembled</span> &mdash; not managed.</h1>
            <p className="subhead">Tasks, habits and focus sessions share one brain, so the day plans itself &mdash; and focus is never a solo habit.</p>
            <div className="hero-ctas">
                <a href="#" className="btn btn-primary">See it in action</a>
                <a href="#" className="btn btn-ghost">Search or command <span className="kbd">Ctrl K</span></a>
            </div>
            <div className="hero-shot shot-frame">
                <div className="chrome"><span className="chrome-dot"></span><span className="chrome-dot"></span><span className="chrome-dot"></span></div>

            </div>
        </section>
    </>
}