# Skill: research before code

When asked to build or change anything user-facing in this repo:

1. **Research first.** Search the web for current UX/design practice for the
   problem (real stores, current trend reports). Extract concrete patterns —
   navigation anatomy, page modules, interaction names — not vibes. Record the
   findings in `docs/RESEARCH.md` with sources.
2. **Diagnose root causes before fixing.** When something looks/works wrong, find
   out *why* (cascade conflict? wrong assumption? no design source?) instead of
   layering another patch. State the cause in the commit message.
3. **Design system next.** Check `docs/DESIGN_SYSTEM.md`. New visual values go
   into the design system FIRST (or are rejected). Never invent raw values in code.
4. **Build in verified steps.** Small commits, each buildable. Verify the build
   before moving on. If the environment breaks (node_modules wiped, node version
   reverted), repair it with the known sequence before anything else.
5. **Be honest about capability limits.** Say what can and cannot be verified.
   Prefer mechanical verification (build, tests, curl) over blind confidence.

Failure mode this skill prevents: shipping blind styling patches that fight the
existing system ("AI slop"), as happened before this skill existed.
