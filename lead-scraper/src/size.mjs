// Too big for a new design studio: in-house design team, long buying cycle.
export const OPEN_JOBS_MAX = 30;
export const openJobs = (l) => Math.max(l.hiring?.open_jobs || 0, l.design_role?.board_jobs || 0);
export const tooBig = (l) => openJobs(l) > OPEN_JOBS_MAX || !!l.site?.large_company_hint;
