import { Link } from "react-router"
import img1 from '../../public/image_1.jpeg'
import img2 from '../../public/image_2.jpeg'
import img3 from '../../public/image_3.jpeg'
import img4 from '../../public/image_4.jpeg'
import img5 from '../../public/image_5.jpeg'


export default function LandingPage() {


    return <>
        {/* NavBar */}
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

        {/* HeroSection */}
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
                <Link to="#modules" className="inline-flex items-center gap-2 px-[22px] py-[11px] rounded-lg text-[14.5px] font-medium bg-panel-lt dark:bg-panel border border-border-lt dark:border-border text-ink-lt dark:text-ink hover:border-[#C7C9D1] dark:hover:border-[#3a3d49] transition-colors duration-150">
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

        {/* Acchievement cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 py-14 px-8 max-w-[1180px] mx-auto">
            <div className="relative overflow-hidden bg-panel-lt dark:bg-panel border border-border-lt dark:border-border rounded-xl pl-[26px] pr-[22px] py-5 transition-colors duration-150">
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-success-lt dark:bg-success"></span>
                <div className="font-mono font-medium text-[26px] mb-1">480+</div>
                <div className="text-[12.5px] text-muted-lt dark:text-muted">automated tests</div>
            </div>
            <div className="relative overflow-hidden bg-panel-lt dark:bg-panel border border-border-lt dark:border-border rounded-xl pl-[26px] pr-[22px] py-5 transition-colors duration-150">
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-warn-lt dark:bg-warn"></span>
                <div className="font-mono font-medium text-[26px] mb-1">99%</div>
                <div className="text-[12.5px] text-muted-lt dark:text-muted">backend coverage</div>
            </div>
            <div className="relative overflow-hidden bg-panel-lt dark:bg-panel border border-border-lt dark:border-border rounded-xl pl-[26px] pr-[22px] py-5 transition-colors duration-150">
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-lt dark:bg-accent"></span>
                <div className="font-mono font-medium text-[26px] mb-1">12</div>
                <div className="text-[12.5px] text-muted-lt dark:text-muted">users per cowork room</div>
            </div>
            <div className="relative overflow-hidden bg-panel-lt dark:bg-panel border border-border-lt dark:border-border rounded-xl pl-[26px] pr-[22px] py-5 transition-colors duration-150">
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-danger-lt dark:bg-danger"></span>
                <div className="font-mono font-medium text-[26px] mb-1">8/8</div>
                <div className="text-[12.5px] text-muted-lt dark:text-muted">capstone objectives met</div>
            </div>
        </div>


        {/* Modules Section */}
        <section id="modules" className="py-[88px] px-8 border-t border-border-soft-lt dark:border-border-soft transition-colors duration-150" id="modules">
            <div className="max-w-[640px] mx-auto mb-14 text-center">
                <div className="font-mono text-xs tracking-[0.1em] text-dim-lt dark:text-dim mb-3 uppercase">One data model, four views</div>
                <h2 className="text-[34px] font-bold tracking-[-0.02em] mb-3.5">Every module speaks the same language</h2>
                <p className="text-muted-lt dark:text-muted text-base leading-relaxed">Complete a task in a focus session and your habit streak updates. Finish a habit and the Today view redraws itself. Nothing needs to be re-entered twice.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center max-w-[1180px] mx-auto mb-[120px]">
                <div>
                    <div className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-accent-strong-lt dark:text-accent-strong mb-4">
                        <span className="w-2 h-2 rounded-[2px] bg-accent-lt dark:bg-accent"></span>TASKS
                    </div>
                    <h3 className="text-[26px] font-semibold tracking-[-0.015em] mb-3.5">An Eisenhower matrix that sorts itself</h3>
                    <p className="text-muted-lt dark:text-muted text-[15.5px] leading-[1.7] mb-[18px]">Subtasks, priorities, due dates and tags &mdash; plus natural-language quick-add. Type &ldquo;pay rent tomorrow !high #home&rdquo; and FlowManager handles the rest.</p>
                    <ul className="space-y-[10px]">
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-accent-lt dark:bg-accent mt-2 flex-shrink-0"></span>Auto-categorised into Do first / Schedule / Delegate / Eliminate</li>
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-accent-lt dark:bg-accent mt-2 flex-shrink-0"></span>List and matrix views of the same underlying tasks</li>
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-accent-lt dark:bg-accent mt-2 flex-shrink-0"></span>Cross-user isolation enforced at the service layer</li>
                    </ul>
                </div>
                <div className="rounded-xl2 border border-border-lt dark:border-border bg-panel-lt dark:bg-panel overflow-hidden shadow-feat-lt dark:shadow-feat transition-colors duration-150">
                    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border-soft-lt dark:border-border-soft bg-bg-raised-lt dark:bg-bg-raised">
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    </div>
                    <img src={img2} alt="Tasks" />
                </div>
            </div>

            {/* Modules Habits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center max-w-[1180px] mx-auto mb-[120px]">
                <div className="md:order-2">
                    <div className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-success-lt dark:text-success mb-4">
                        <span className="w-2 h-2 rounded-[2px] bg-success-lt dark:bg-success"></span>HABITS
                    </div>
                    <h3 className="text-[26px] font-semibold tracking-[-0.015em] mb-3.5">Streaks that understand your schedule</h3>
                    <p className="text-muted-lt dark:text-muted text-[15.5px] leading-[1.7] mb-[18px]">Hourly, daily or weekly cadence, with active hours and active weekdays &mdash; so a sleeping user is never marked as having missed anything.</p>
                    <ul className="space-y-[10px]">
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-success-lt dark:bg-success mt-2 flex-shrink-0"></span>Idempotent completion &amp; undo, streaks that never go negative</li>
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-success-lt dark:bg-success mt-2 flex-shrink-0"></span>Exponential-decay habit-strength score</li>
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-success-lt dark:bg-success mt-2 flex-shrink-0"></span>A week grid that shows done, missed and not-yet-due at a glance</li>
                    </ul>
                </div>
                <div className="md:order-1 rounded-xl2 border border-border-lt dark:border-border bg-panel-lt dark:bg-panel overflow-hidden shadow-feat-lt dark:shadow-feat transition-colors duration-150">
                    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border-soft-lt dark:border-border-soft bg-bg-raised-lt dark:bg-bg-raised">
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    </div>
                    <img src={img3} alt="Habits" />
                </div>
            </div>


            {/* Modules Focus  */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center max-w-[1180px] mx-auto">
                <div>
                    <div className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-warn-lt dark:text-warn mb-4">
                        <span className="w-2 h-2 rounded-[2px] bg-warn-lt dark:bg-warn"></span>FOCUS
                    </div>
                    <h3 className="text-[26px] font-semibold tracking-[-0.015em] mb-3.5">Pomodoro sessions built from real work</h3>
                    <p className="text-muted-lt dark:text-muted text-[15.5px] leading-[1.7] mb-[18px]">Session items are pulled straight from your tasks and habits &mdash; not typed in fresh. Pause, resume, complete or quit, with a running history of every block.</p>
                    <ul className="space-y-[10px]">
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-warn-lt dark:bg-warn mt-2 flex-shrink-0"></span>Configurable focus-and-break rhythm</li>
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-warn-lt dark:bg-warn mt-2 flex-shrink-0"></span>Items completed independently within the session</li>
                        <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-warn-lt dark:bg-warn mt-2 flex-shrink-0"></span>Full session history feeds the analytics layer</li>
                    </ul>
                </div>
                <div className="rounded-xl2 border border-border-lt dark:border-border bg-panel-lt dark:bg-panel overflow-hidden shadow-feat-lt dark:shadow-feat transition-colors duration-150">
                    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border-soft-lt dark:border-border-soft bg-bg-raised-lt dark:bg-bg-raised">
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                        <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    </div>
                    <img src={img4} alt="Focus" />
                </div>
            </div>
        </section>
        
        {/* Co-op Section */}
        <section className="py-[88px] px-8 border-t border-border-soft-lt dark:border-border-soft bg-bg-raised-lt dark:bg-bg-raised transition-colors duration-150" id="cowork">
            <div className="max-w-[640px] mx-auto mb-14 text-center">
                <div className="font-mono text-xs tracking-[0.1em] text-dim-lt dark:text-dim mb-3 uppercase">Beyond the original scope</div>
                <h2 className="text-[34px] font-bold tracking-[-0.02em] mb-3.5">Cowork Rooms &mdash; focus, out loud</h2>
                <p className="text-muted-lt dark:text-muted text-base leading-relaxed">Up to twelve authenticated users share live video and a synchronised task list. Media is routed through a Cloudflare Realtime SFU, not meshed peer-to-peer &mdash; so the room stays smooth as it fills up.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center max-w-[1180px] mx-auto">
                <div>
                <div className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-violet-lt dark:text-violet mb-4">
                    <span className="w-2 h-2 rounded-[2px] bg-violet-lt dark:bg-violet"></span>COWORK ROOMS
                </div>
                <h3 className="text-[26px] font-semibold tracking-[-0.015em] mb-3.5">A live, task-aware body-double</h3>
                <p className="text-muted-lt dark:text-muted text-[15.5px] leading-[1.7] mb-[18px]">Every participant sees who's here, what they're working on, and can share a task into the room &mdash; without leaving the workspace or opening a separate call app.</p>
                <ul className="space-y-[10px]">
                    <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-violet-lt dark:bg-violet mt-2 flex-shrink-0"></span>Unguessable slugs, 24-hour room expiry</li>
                    <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-violet-lt dark:bg-violet mt-2 flex-shrink-0"></span>One upload stream per participant, regardless of room size</li>
                    <li className="flex items-start gap-[10px] text-[14.5px]"><span className="w-[5px] h-[5px] rounded-full bg-violet-lt dark:bg-violet mt-2 flex-shrink-0"></span>Every Cloudflare credential stays server-side</li>
                </ul>
                </div>
                <div className="rounded-xl2 border border-border-lt dark:border-border bg-panel-lt dark:bg-panel overflow-hidden shadow-feat-lt dark:shadow-feat transition-colors duration-150">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border-soft-lt dark:border-border-soft bg-bg-raised-lt dark:bg-bg-raised">
                    <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                    <span className="w-[9px] h-[9px] rounded-full bg-[#D8D9DE] dark:bg-[#2A2C35]"></span>
                </div>
                 <img src={img5}  alt="Cowork Rooms"/> 
                </div>
            </div>
        </section>
    

    </>
}