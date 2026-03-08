const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

setGlobalOptions({ region: 'us-central1' });
initializeApp();
const db = getFirestore();

const ADMIN_EMAILS = [
  'Johnny@istulsa.com',
  'Jordan@istulsa.com',
  'Skip@istulsa.com',
  'Duck@istulsa.com',
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
