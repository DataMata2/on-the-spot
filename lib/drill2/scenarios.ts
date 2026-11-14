// Drill 2 scenarios: a manager gives a vague task; the hidden facts are what a good clarifier finds out.
// Authored examples for office professionals in US tech companies. Hidden values live only on the server.

import type { Scenario } from "./types";

const Q_CONFLICTS = ["q1", "q2", "q4", "first quarter", "second quarter", "fourth quarter", "1st quarter", "2nd quarter", "4th quarter"];

/** S1, training: "the numbers for Thursday". */
export const NUMBERS_FOR_THURSDAY: Scenario = {
  id: "numbers-thursday",
  version: 1,
  title: "The numbers for Thursday",
  managerName: "Rachel",
  managerRole: "your manager, Head of Growth",
  managerLine: "Can you put together the numbers for Thursday? Keep it short.",
  context: "You're an analyst on the growth team. Rachel stops by your desk on Monday afternoon, on her way to another meeting.",
  hiddenFacts: [
    {
      key: "metric",
      label: "Which numbers",
      display: "Q3 churn, broken down by plan",
      check: { kind: "parts" },
      parts: [
        {
          id: "churn",
          label: "churn",
          aliases: ["churn", "churn rate", "churned", "churned customers", "cancellations", "cancelations", "customers we lost", "lost customers", "attrition"],
          conflicts: ["revenue", "mrr", "arr", "signups", "sign ups", "new customers", "pipeline", "bookings", "nps", "usage", "conversion"],
        },
        {
          id: "q3",
          label: "Q3",
          aliases: ["q3", "q 3", "third quarter", "3rd quarter", "quarter three", "quarter 3", "july to september", "july through september"],
          conflicts: Q_CONFLICTS,
        },
        {
          id: "by_plan",
          label: "by plan",
          aliases: [
            "by plan", "per plan", "each plan", "every plan", "by plan type", "by pricing plan", "by subscription plan", "by tier",
            "per tier", "by pricing tier", "plan by plan", "split by plan", "broken down by plan", "breakdown by plan", "across plans",
            "across all plans", "for each plan", "by plans",
          ],
          conflicts: ["by region", "per region", "by country", "by segment", "by channel", "by team"],
        },
      ],
      revealLine: "The Q3 churn numbers, broken down by plan. That's what the execs asked about.",
      topics: ["metric"],
      hint: "Ask which numbers she means: which metric, and for which period.",
      askLabel: "which numbers they want: the metric, the period, the breakdown",
    },
    {
      key: "format",
      label: "Format",
      display: "3 slides",
      check: { kind: "number", value: 3, units: ["slides", "slide", "page deck"] },
      parts: [
        {
          id: "slides",
          label: "slides",
          aliases: ["slide", "slides", "deck", "slide deck", "powerpoint", "google slides", "keynote", "ppt"],
          conflicts: ["one pager", "spreadsheet", "excel", "google doc", "word doc", "memo", "dashboard"],
        },
      ],
      revealLine: "Three slides, max. Keep it tight.",
      topics: ["format"],
      hint: "Ask what “short” means: what format, and how long.",
      askLabel: "the format and length of the deliverable",
    },
    {
      key: "time",
      label: "When on Thursday",
      display: "10:00 am, the exec sync",
      check: { kind: "time", value: "10:00", bareHourOk: true, relation: "by" },
      revealLine: "It's for the exec sync on Thursday at 10 a.m., so I need it before then.",
      topics: ["time", "audience"],
      hint: "Ask what exactly happens on Thursday, and at what time.",
      askLabel: "the time on Thursday it is needed for",
    },
  ],
  visibleFacts: [
    {
      key: "day",
      label: "Day",
      display: "Thursday",
      check: { kind: "weekday", value: "thursday" },
      revealLine: "This Thursday, yes.",
      topics: ["day"],
      hint: "Say the day back.",
      askLabel: "the day",
    },
  ],
  topics: [
    { key: "metric", description: "which numbers, data, metric or KPI they want, for which period, or broken down how", keywords: ["which numbers", "what numbers", "metric", "metrics", "kpi", "which data", "what data", "churn", "revenue", "quarter", "breakdown", "figures", "broken down"] },
    { key: "format", description: "the format, length or type of deliverable (slides, doc, spreadsheet, how long, how detailed)", keywords: ["format", "slides", "slide", "deck", "doc", "document", "spreadsheet", "how long", "how many", "length", "how detailed", "short", "pages", "presentation"] },
    { key: "time", description: "the time or deadline: when exactly it is needed", keywords: ["what time", "when", "deadline", "by when", "time", "morning", "afternoon", "o clock"] },
    { key: "audience", description: "who it is for, who will see it, or which meeting it is for", keywords: ["who", "audience", "meeting", "present", "presenting", "execs", "for whom", "who is it for"] },
    { key: "day", description: "which day or date (this Thursday or another)", keywords: ["which thursday", "this thursday", "next thursday", "date", "which day"] },
  ],
  lesson: {
    construction: "Just to confirm, by X do you mean Y?",
    example: "Just to confirm, by “the numbers” do you mean Q3 churn by plan?",
  },
};

/** S2, transfer: the same skill on a different task. */
export const CUSTOMER_UPDATE: Scenario = {
  id: "customer-update",
  version: 1,
  title: "An update about the delay",
  managerName: "Tom",
  managerRole: "your manager, Head of Product",
  managerLine: "Could you send the customer an update about the delay? Today, please.",
  context: "You're a product manager. Release 2.4 slipped by a week. Two customers, Acme and Globex, have been waiting for it. Tom pings you between meetings.",
  hiddenFacts: [
    {
      key: "customer",
      label: "Which customer",
      display: "Acme",
      check: { kind: "parts" },
      parts: [
        {
          id: "acme",
          label: "Acme",
          aliases: ["acme", "acme corp", "acme corporation"],
          conflicts: ["globex", "both customers", "both of them", "all customers", "every customer"],
        },
      ],
      revealLine: "Acme. Globex already knows; I told them myself yesterday.",
      topics: ["customer"],
      hint: "Ask which customer he means: two of them are waiting.",
      askLabel: "which customer the update goes to",
    },
    {
      key: "channel",
      label: "How to send it",
      display: "Email, cc Jenna (their account manager)",
      check: { kind: "parts" },
      parts: [
        { id: "email", label: "by email", aliases: ["email", "e mail", "mail"], conflicts: ["slack", "call", "phone", "zoom", "text message", "sms", "teams", "meeting"] },
        { id: "jenna", label: "cc Jenna, the account manager", aliases: ["jenna", "account manager", "their account manager", "the account manager", "csm"] },
      ],
      revealLine: "Email is best, and cc Jenna, their account manager, so she's in the loop.",
      topics: ["channel", "people"],
      hint: "Ask how to send it, and who should be in the loop.",
      askLabel: "how to send the update and who to copy",
    },
    {
      key: "deadline",
      label: "Deadline",
      display: "Before 5:00 pm Pacific",
      check: { kind: "time", value: "17:00", bareHourOk: false, relation: "by" },
      parts: [
        {
          id: "pacific",
          label: "Pacific time",
          aliases: ["pacific", "pacific time", "pt", "pst", "pdt", "west coast time", "california time", "seattle time"],
          conflicts: ["eastern", "et", "est", "edt", "central", "ct", "cst", "mountain", "mt", "utc", "gmt", "new york time"],
        },
      ],
      revealLine: "Before 5 p.m. Pacific. Their team is in Seattle and signs off early.",
      topics: ["deadline"],
      hint: "Ask what “today” means: by what time, and in which time zone.",
      askLabel: "the deadline today: the time and the time zone",
    },
  ],
  visibleFacts: [],
  topics: [
    { key: "customer", description: "which customer or account the update is for", keywords: ["which customer", "customer", "client", "account", "acme", "globex", "which one"] },
    { key: "channel", description: "how to send it: email, Slack, a call, a ticket", keywords: ["email", "slack", "call", "channel", "how should i send", "how do i send", "phone"] },
    { key: "people", description: "who to copy, loop in or involve", keywords: ["cc", "copy", "loop in", "include", "anyone else", "who else"] },
    { key: "deadline", description: "by what time today, or in which time zone", keywords: ["what time", "when", "deadline", "by when", "time zone", "timezone", "end of day", "eod"] },
    {
      key: "content",
      description: "what to say in the update: the new date, the reason, the tone",
      keywords: ["what should i say", "what to say", "new date", "reason", "tone", "what should it say"],
      line: "Just the new date, the 21st, and a short sorry. Nothing technical.",
    },
  ],
  transferOf: "numbers-thursday",
  lesson: {
    construction: "When you say X, do you mean Y or Z?",
    example: "When you say “the customer”, do you mean Acme or Globex?",
  },
};

/** S3, change of condition: the manager clearly moves one detail mid-way; the old value no longer counts. */
export const KICKOFF_CHANGE: Scenario = {
  id: "kickoff-change",
  version: 1,
  title: "The kickoff call",
  managerName: "Sam",
  managerRole: "your manager, Director of Delivery",
  managerLine: "Can you set up the kickoff call with Northwind for Tuesday? Invite the right people.",
  context: "You're a project manager. Northwind, a new client, signed last week. Sam messages you right after a call with them.",
  hiddenFacts: [
    {
      key: "attendees",
      label: "Who to invite",
      display: "Priya (sales) and Marco (support)",
      check: { kind: "parts" },
      parts: [
        { id: "priya", label: "Priya", aliases: ["priya"], conflicts: ["everyone", "whole team", "the team", "all hands"] },
        { id: "marco", label: "Marco", aliases: ["marco"] },
      ],
      revealLine: "Priya from sales and Marco from support. Nobody else, keep it small.",
      topics: ["people"],
      hint: "Ask who exactly “the right people” are.",
      askLabel: "who to invite",
    },
    {
      key: "time",
      label: "Time",
      display: "2:00 pm",
      check: { kind: "time", value: "14:00", bareHourOk: true, relation: "at" },
      revealLine: "At 2 p.m., after their lunch.",
      topics: ["time"],
      hint: "Ask what time works.",
      askLabel: "the time of the call",
    },
    {
      key: "duration",
      label: "Length",
      display: "30 minutes",
      check: {
        kind: "number",
        value: 30,
        units: ["minutes", "minute", "mins", "min"],
        otherUnits: ["seconds", "second", "secs", "sec", "hours", "hour", "hrs", "hr", "days", "day"],
        rangeSpanMinutes: true,
      },
      revealLine: "Thirty minutes is plenty.",
      topics: ["duration"],
      hint: "Ask how long the call should be.",
      askLabel: "how long the call is",
    },
  ],
  visibleFacts: [
    {
      key: "day",
      label: "Day",
      display: "Tuesday",
      check: { kind: "weekday", value: "tuesday" },
      revealLine: "Tuesday.",
      topics: ["day"],
      hint: "Say the day back, and listen for changes.",
      askLabel: "the day of the call",
    },
  ],
  topics: [
    { key: "people", description: "who to invite or who “the right people” are", keywords: ["who", "invite", "people", "attendees", "right people", "include", "team"] },
    { key: "time", description: "what time the call is", keywords: ["what time", "time", "when", "morning", "afternoon"] },
    { key: "duration", description: "how long the call should be", keywords: ["how long", "duration", "minutes", "length", "hour"] },
    { key: "day", description: "which day or date", keywords: ["which day", "day", "date", "tuesday", "wednesday"] },
    {
      key: "agenda",
      description: "the agenda or what the call covers",
      keywords: ["agenda", "cover", "discuss", "topics", "prepare"],
      line: "Just intros and the rollout timeline. I'll bring the deck.",
    },
  ],
  change: {
    factKey: "day",
    value: "wednesday",
    display: "Wednesday (moved from Tuesday)",
    announceLine: "Oh, one change before I forget: Northwind just asked to move it. Make it Wednesday, not Tuesday.",
    revealLine: "Wednesday now, not Tuesday. Northwind moved it.",
    fireOnTurn: 1,
  },
  transferOf: "numbers-thursday",
  lesson: {
    construction: "So just to make sure I have the latest: X, not Y?",
    example: "So it's Wednesday now, not Tuesday, at 2 p.m. with Priya and Marco?",
  },
};

export const SCENARIOS: Scenario[] = [NUMBERS_FOR_THURSDAY, CUSTOMER_UPDATE, KICKOFF_CHANGE];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** The server's pick: the first scenario this guest hasn't done, else the one after the last done. */
export function pickScenario(done: string[]): Scenario {
  const next = SCENARIOS.find((s) => !done.includes(s.id));
  if (next) return next;
  const last = SCENARIOS.findIndex((s) => s.id === done[done.length - 1]);
  return SCENARIOS[(last + 1) % SCENARIOS.length];
}
