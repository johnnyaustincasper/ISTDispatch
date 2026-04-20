const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const { OpenAI } = require('openai');

const OPENAI_KEY = defineSecret('OPENAI_API_KEY');

setGlobalOptions({ region: 'us-central1' });
initializeApp();
const db = getFirestore();

const ADMIN_EMAILS = [
  'Johnny@istulsa.com',
  'Jordan@istulsa.com',
  'Skip@istulsa.com',
];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'dispatchedbyist@gmail.com',
    pass: 'vokb tsey hpjy nef',
  },
});

async function sendEmail(to, subject, html) {
  const recipients = Array.isArray(to) ? to.join(',') : to;
  await transporter.sendMail({
    from: '"IST Dispatch" <dispatchedbyist@gmail.com>',
    to: recipients,
    subject,
    html,
  });
}

async function getCrewEmail(truckId) {
  const snap = await db.collection('trucks').doc(truckId).get();
  return snap.exists ? snap.data().email || null : null;
}

// ─── New job added → notify assigned truck's crew ───
exports.onJobAdded = onDocumentCreated('jobs/{jobId}', async (event) => {
  const job = event.data.data();
  if (!job.truckId) return;
  const crewEmail = await getCrewEmail(job.truckId);
  if (!crewEmail) return;

  await sendEmail(crewEmail, `📋 New Job: ${job.address || 'New Job'}`,
    `<h2>New Job Assigned</h2>
     <p><strong>Address:</strong> ${job.address || 'N/A'}</p>
     <p><strong>Type:</strong> ${job.jobType || 'N/A'}</p>
     <p><strong>Date:</strong> ${job.date || 'N/A'}</p>
     <p><strong>Notes:</strong> ${job.notes || 'None'}</p>
     <br><a href="https://www.istdispatch.com">Open IST Dispatch</a>`
  );
});

// ─── New ticket → notify all admins ───
exports.onTicketCreated = onDocumentCreated('tickets/{ticketId}', async (event) => {
  const ticket = event.data.data();

  // Also notify the crew member who submitted it if they have an email
  const crewEmail = ticket.truckId ? await getCrewEmail(ticket.truckId) : null;
  const recipients = crewEmail
    ? [...ADMIN_EMAILS, crewEmail]
    : ADMIN_EMAILS;

  await sendEmail(recipients, `🎫 New Ticket: ${ticket.description?.slice(0, 50) || 'New Ticket'}`,
    `<h2>New Ticket Submitted</h2>
     <p><strong>Truck:</strong> ${ticket.truckId || 'N/A'}</p>
     <p><strong>Priority:</strong> ${ticket.priority || 'N/A'}</p>
     <p><strong>Description:</strong> ${ticket.description || 'N/A'}</p>
     <p><strong>Status:</strong> ${ticket.status || 'open'}</p>
     <br><a href="https://www.istdispatch.com">Open IST Dispatch</a>`
  );
});

// ─── Ticket updated → only notify if crew made the change (has truckId/crewName) ───
exports.onTicketUpdated = onDocumentUpdated('tickets/{ticketId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status && before.reply === after.reply) return;
  // Skip if updated by admin (no truckId means admin action)
  if (!after.truckId) return;

  const crewEmail = await getCrewEmail(after.truckId);
  const recipients = crewEmail ? [...ADMIN_EMAILS, crewEmail] : ADMIN_EMAILS;

  await sendEmail(recipients, `🔄 Ticket Updated: ${after.description?.slice(0, 50) || 'Ticket'}`,
    `<h2>Ticket Updated by Crew</h2>
     <p><strong>Truck:</strong> ${after.truckId || 'N/A'}</p>
     <p><strong>Status:</strong> ${after.status || 'N/A'}</p>
     <p><strong>Description:</strong> ${after.description || 'N/A'}</p>
     ${after.reply ? `<p><strong>Reply:</strong> ${after.reply}</p>` : ''}
     <br><a href="https://www.istdispatch.com">Open IST Dispatch</a>`
  );
});

// ─── New crew update → notify all admins (crew always has crewName field) ───
exports.onJobUpdateCreated = onDocumentCreated('updates/{updateId}', async (event) => {
  const update = event.data.data();
  // Only fire for crew updates (have crewName), not admin PM notes
  if (!update.crewName) return;

  await sendEmail(ADMIN_EMAILS, `📢 Crew Update from ${update.crewName}`,
    `<h2>Crew Update</h2>
     <p><strong>Crew:</strong> ${update.crewName || 'N/A'}</p>
     <p><strong>Status:</strong> ${update.status || 'N/A'}</p>
     <p><strong>Notes:</strong> ${update.notes || 'None'}</p>
     <p><strong>ETA:</strong> ${update.eta || 'N/A'}</p>
     <br><a href="https://www.istdispatch.com">Open IST Dispatch</a>`
  );
});

// ── scanWorkOrder — GPT-4o mini vision extraction ─────────────────────────────
exports.scanWorkOrder = onCall({ secrets: [OPENAI_KEY], timeoutSeconds: 30 }, async (request) => {
  const { imageBase64, mimeType = 'image/jpeg' } = request.data || {};
  if (!imageBase64) throw new HttpsError('invalid-argument', 'imageBase64 is required');

  const openai = new OpenAI({ apiKey: OPENAI_KEY.value() });

  const prompt = `You are extracting job information from an insulation work order photo. There may be sticky notes on the work order with crew member first names written on them.
Return ONLY a valid JSON object with these fields (use null for anything not found):
{
  "builder": "customer or builder name",
  "address": "full job site address",
  "type": "insulation type or job type (e.g. Blown-In Attic, Batt Walls, Spray Foam, Energy Seal)",
  "date": "scheduled date in YYYY-MM-DD format",
  "sqft": "square footage as a number (digits only, no units)",
  "revenue": "contract price or total as a number (digits only, no $ sign)",
  "notes": "any special instructions, access notes, or additional details",
  "crewNames": ["array of crew member names or first names found on sticky notes or written anywhere on the work order — empty array if none found"]
}
If a field is unclear or not present, use null. Do not include any explanation outside the JSON.`;

  let response;
  try {
    response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
        ],
      }],
    });
  } catch (err) {
    throw new HttpsError('internal', 'OpenAI request failed: ' + err.message);
  }

  const raw = response.choices?.[0]?.message?.content?.trim() || '';
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new HttpsError('internal', 'Could not parse GPT response as JSON: ' + raw);
  }

  return { result: parsed };
});
