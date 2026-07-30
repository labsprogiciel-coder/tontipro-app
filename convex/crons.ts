// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "refresh goal statuses",
  { hourUTC: 1, minuteUTC: 0 },
  internal.goals.refreshStatuses,
);

export default crons;