import assert from "node:assert/strict";
import { buildDailyAgenda, buildDailyAgendaFileName } from "../src/features/agenda/agendaExport.js";

const trucks = [
  { id: "t2", name: "Blow 2", vehicleName: "B2", members: "Old Crew", order: 2 },
  { id: "t1", name: "Foam 1", vehicleName: "F1", members: "Foam Truck", order: 1 },
  { id: "t3", name: "Blow 3", vehicleName: "B3", members: "Empty Crew", order: 3 },
];
const members = [
  { id: "m1", name: "John Smith" },
  { id: "m2", name: "Mike Jones" },
  { id: "m3", name: "Sara Lane" },
];
const jobs = [
  { id: "j1", date: "2026-06-08", truckId: "t1", crewMemberIds: ["m1", "m2"], builder: "Acme Homes", address: "123 Main St", type: "Foam", jobCategory: "New Construction", notes: "Gate code 1234" },
  { id: "j2", date: "2026-06-08", truckId: "t2", crewMemberIds: ["m3"], builder: "Brown Remodel", address: "88 Pine Ave", type: "Fiberglass" },
  { id: "j3", date: "2026-06-09", truckId: "t1", crewMemberIds: ["m1"], builder: "Tomorrow Job", address: "Not today", type: "Foam" },
  { id: "j4", date: "2026-06-08", truckId: "", crewMemberIds: [], builder: "No Truck Yet", address: "44 Center Rd", type: "Removal" },
  { id: "j5", date: "2026-06-08", truckId: "t2", crewMemberIds: ["m3"], builder: "Hold Job", address: "Hidden", type: "Fiberglass", onHold: true },
  { id: "j6", date: "2026-06-08", truckId: "t2", crewMemberIds: ["m3"], builder: "Done Today", address: "Already finished", type: "Fiberglass" },
  { id: "j7", date: "2026-06-07", truckId: "t1", crewMemberIds: ["m1"], builder: "Yesterday Done", address: "Old job", type: "Foam" },
  { id: "j8", date: "2026-06-08", truckId: "t1", crewMemberIds: ["m1"], builder: "Rescheduled Active", address: "22 Redo Rd", type: "Foam" },
  { id: "j9", date: "2026-06-07", truckId: "t2", crewMemberIds: ["m3"], builder: "Started Off Date", address: "77 Active Rd", type: "Fiberglass" },
];
const updates = [
  { jobId: "j2", status: "in_progress", timeStr: "8:15 AM", timestamp: "2026-06-08T13:15:00.000Z" },
  { jobId: "j6", status: "completed", timeStr: "11:30 AM", timestamp: "2026-06-08T16:30:00.000Z" },
  { jobId: "j7", status: "completed", timeStr: "4:15 PM", timestamp: "2026-06-08T21:15:00.000Z" },
  { jobId: "j8", status: "completed", timeStr: "3:00 PM", timestamp: "2026-06-07T20:00:00.000Z" },
  { jobId: "j9", status: "in_progress", timeStr: "9:45 AM", timestamp: "2026-06-08T14:45:00.000Z" },
];

const agenda = buildDailyAgenda({ jobs, trucks, members, updates, date: "2026-06-08", scheduleView: "insulation" });

assert.equal(agenda.title, "IST Daily Agenda");
assert.equal(agenda.date, "2026-06-08");
assert.deepEqual(agenda.summary, { trucks: 4, jobs: 5, unassignedJobs: 1 });
assert.deepEqual(agenda.sections.map((section) => section.truckName), ["F1", "B2", "B3", "Unassigned"]);
assert.equal(agenda.sections[0].crew, "John Smith, Mike Jones");
assert.equal(agenda.sections[0].jobs[0].destination, "123 Main St");
assert.equal(agenda.sections[1].jobs[0].status, "In Progress");
assert.equal(agenda.sections[2].jobs.length, 0);
assert.equal(agenda.sections[2].crew, "Empty Crew");
assert.equal(agenda.sections[3].jobs[0].crew, "Unassigned");
assert(!agenda.sections.flatMap((section) => section.jobs).some((job) => job.customer === "Tomorrow Job"));
assert(!agenda.sections.flatMap((section) => section.jobs).some((job) => job.customer === "Hold Job"));
assert(!agenda.sections.flatMap((section) => section.jobs).some((job) => job.customer === "Done Today"));
assert(!agenda.sections.flatMap((section) => section.jobs).some((job) => job.customer === "Yesterday Done"));
assert(agenda.sections.flatMap((section) => section.jobs).some((job) => job.customer === "Rescheduled Active" && job.statusValue === "not_started"));
assert(agenda.sections.flatMap((section) => section.jobs).some((job) => job.customer === "Started Off Date" && job.statusValue === "in_progress"));
assert(agenda.sections.flatMap((section) => section.jobs).every((job) => job.statusValue !== "completed"));

const activeBoardAgenda = buildDailyAgenda({
  jobs: [
    { id: "ed", date: "2026-06-12", truckId: "t1", crewMemberIds: ["m1", "m2"], builder: "Ed Bedient", address: "702 E Osage St", type: "Foam", jobCategory: "Retro" },
    { id: "brian", date: "2026-10-01", truckId: "foam2", crewMemberIds: ["m3"], builder: "Brian Hadley", address: "", type: "Foam", jobCategory: "Retro" },
  ],
  trucks: [...trucks, { id: "foam2", name: "Foam 2", vehicleName: "F2", members: "Foam Truck 2", order: 1.5 }],
  members,
  updates: [],
  date: "2026-06-15",
  scheduleView: "insulation",
  includeAllActiveJobs: true,
});
assert.equal(activeBoardAgenda.summary.jobs, 2);
assert(activeBoardAgenda.sections.find((section) => section.truckName === "F1")?.jobs.some((job) => job.customer === "Ed Bedient"));
assert(activeBoardAgenda.sections.find((section) => section.truckName === "F2")?.jobs.some((job) => job.customer === "Brian Hadley"));

assert.equal(buildDailyAgendaFileName("2026-06-08", "insulation"), "IST-insulation-agenda-2026-06-08.png");

console.log("daily agenda export tests passed");
