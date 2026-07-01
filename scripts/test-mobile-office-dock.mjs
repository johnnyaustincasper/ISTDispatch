import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/App.jsx', 'utf8');

assert.match(source, /const \[mobileOfficeNavOpen, setMobileOfficeNavOpen\] = useState\(false\)/, 'Admin dashboard should track collapsed mobile dock open state');
assert.match(source, /office-mobile-nav-launcher/, 'Mobile office dock should render a single launcher button');
assert.match(source, /office-mobile-nav-panel/, 'Mobile office dock should render an expandable icon panel');
assert.match(source, /aria-expanded=\{mobileOfficeNavOpen\}/, 'Launcher should expose expanded state for accessibility');
assert.match(source, /setMobileOfficeNavClosing\(true\); setMobileOfficeNavOpen\(false\); setView\(item\.key\)/, 'Selecting a nav item should collapse the dock again');
assert.match(source, /\.office-mobile-bottom-nav \{ position: fixed; left: 50%; right: auto;/, 'Mobile dock should be centered, not full-width');
assert.match(source, /\.office-mobile-nav-panel \{ position: absolute; bottom: calc\(100% \+ 10px\); left: 50%;/, 'Expanded icons should pop out above the center launcher');
assert.match(source, /grid-template-columns: repeat\(4, 58px\)/, 'Expanded panel should wrap icons instead of stretching the dock');
assert.match(source, /office-mobile-nav-panel \$\{mobileOfficeNavOpen \? "open"/, 'Open panel should have a distinct animation class');
assert.match(source, /mobileOfficeNavClosing \? "closing"/, 'Closing panel should stay mounted long enough to animate shut');
assert.match(source, /@keyframes officeMobileDockOpen/, 'Dock should define an opening animation');
assert.match(source, /@keyframes officeMobileDockClose/, 'Dock should define a closing animation');
assert.match(source, /animation: officeMobileDockOpen 180ms cubic-bezier/, 'Open panel should animate with a snappy easing curve');
assert.match(source, /animation: officeMobileDockClose 150ms ease-in forwards/, 'Close panel should animate instead of disappearing instantly');
assert.match(source, /transition: transform 180ms ease, box-shadow 180ms ease/, 'Launcher button should animate as the dock opens and closes');
assert.match(source, /setMobileOfficeNavClosing\(true\)/, 'Closing state should trigger the dock close animation');
assert.doesNotMatch(source, /\.office-mobile-nav-panel\.closed \{ display: none; \}/, 'Closed panel should not use display:none because that prevents exit animation');
assert.doesNotMatch(source, /\.office-mobile-bottom-nav \{ position: fixed; left: 8px; right: 8px;/, 'Old full-width bottom dock should be removed');

console.log('mobile office dock checks passed');
