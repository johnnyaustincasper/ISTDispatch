import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

const checks = [
  {
    name: 'TV completed jobs render in a dedicated completed-today section',
    pass: /className="schedule-tv-completed-section"/.test(source)
      && /Completed today · \{tvCompletedJobs\.length\}/.test(source),
  },
  {
    name: 'TV mode separates active jobs from completed-today jobs',
    pass: /const tvActiveJobs = \[\.\.\.boardJobs\]\.filter\(\(job\) => !isJobCompletedForSchedule\(job\)\)/.test(source)
      && /const tvCompletedJobs = jobs[\s\S]*isCompletedTodayForTv/.test(source),
  },
  {
    name: 'Completed TV jobs collapse when not expanded',
    pass: /if \(isDone && !isExpanded\)/.test(source),
  },
  {
    name: 'Completed today section has a collapsed-by-default section toggle',
    pass: /const \[tvCompletedCollapsed, setTvCompletedCollapsed\] = useState\(true\)/.test(source)
      && /className="schedule-tv-completed-toggle"/.test(source)
      && /setTvCompletedCollapsed\(prev => !prev\)/.test(source)
      && /aria-expanded=\{!tvCompletedCollapsed\}/.test(source),
  },
  {
    name: 'Completed list renders only when section is expanded',
    pass: /!tvCompletedCollapsed && <div className="schedule-tv-completed-list"/.test(source)
      && /\{tvCompletedCollapsed \? "Show" : "Collapse"\}/.test(source),
  },
  {
    name: 'Expanded completed TV card has Hide button',
    pass: /isDone && isExpanded && <button[\s\S]*>Hide<\/button>/.test(source),
  },
  {
    name: 'Completed bar labels the job/customer section and includes address',
    pass: /JOB · \{displayType\}/.test(source) && /\{job\.address \|\| "No address"\}/.test(source),
  },
  {
    name: 'Completed bar labels crew/truck and displays truck name',
    pass: /Crew \/ Truck/.test(source) && /truck \? truckDisplayName\(truck\) : "No truck"/.test(source),
  },
  {
    name: 'Completed bars have wider readable sizing CSS',
    pass: /\.schedule-tv-completed-bar \{[^}]*flex: 1 1 520px;[^}]*min-width: 420px;[^}]*min-height: 76px;/.test(source)
      && /\.office-tv-mode \.schedule-tv-completed-bar \{[^}]*\/ 2\)/.test(source),
  },
  {
    name: 'TV mode defines dedicated F1-F3 and B1-B4 truck lanes',
    pass: /const TV_INSULATION_TRUCK_ROWS = \[[\s\S]*shortLabel: "F1"[\s\S]*shortLabel: "F2"[\s\S]*shortLabel: "F3"[\s\S]*shortLabel: "B1"[\s\S]*shortLabel: "B2"[\s\S]*shortLabel: "B3"[\s\S]*shortLabel: "B4"/.test(source),
  },
  {
    name: 'TV active jobs are grouped into truck rows before rendering',
    pass: /const tvTruckRows = scheduleView === "insulation"[\s\S]*TV_INSULATION_TRUCK_ROWS\.map[\s\S]*getTvTruckLaneKey/.test(source)
      && /className="schedule-tv-truck-rows"/.test(source)
      && /className="schedule-tv-truck-row"/.test(source)
      && /className="schedule-tv-truck-row-jobs"/.test(source),
  },
  {
    name: 'Truck lane CSS uses top-to-bottom columns across the TV',
    pass: /\.schedule-tv-truck-rows \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/.test(source)
      && /\.schedule-tv-truck-row \{[^}]*flex-direction: column/.test(source)
      && /\.schedule-tv-truck-row-jobs \{[^}]*flex-direction: column[\s\S]*flex-wrap: nowrap/.test(source)
      && /\.schedule-tv-truck-empty/.test(source),
  },
  {
    name: 'TV active job cards include a clickable Materials button and modal',
    pass: /className="schedule-tv-materials-button"/.test(source)
      && /setTvMaterialsJobId\(job\.id\)/.test(source)
      && /role="dialog" aria-modal="true"/.test(source)
      && /No materials logged for this job yet/.test(source),
  },
  {
    name: 'TV active card status uses compact Progress label and customer can wrap to two lines',
    pass: /const tvStatusLabel = latest\?\.status === "in_progress" \? "Progress"/.test(source)
      && /\.schedule-tv-truck-row \.schedule-tv-customer \{[^}]*-webkit-line-clamp: 2/.test(source),
  },
  {
    name: 'TV active type/category header cannot overlap status in narrow lanes',
    pass: /className="schedule-tv-type-line"/.test(source)
      && /className="schedule-tv-status-pill"/.test(source)
      && /\.schedule-tv-type-line \{[^}]*flex: 1 1 auto/.test(source)
      && !/className="schedule-tv-type-line"[\s\S]{0,500}categoryDisplayLabel\(job\)/.test(source),
  },
];

const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error('TV completed bar regression failed:');
  for (const check of failed) console.error(`- ${check.name}`);
  process.exit(1);
}

console.log('tv completed bar checks passed');
