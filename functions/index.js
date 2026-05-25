const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

const MESSAGES = {
  approved: {
    title: 'Application Approved 🎉',
    body: 'Your membership application has been approved. Welcome to Excellent Susu!',
  },
  rejected: {
    title: 'Application Update',
    body: 'Your membership application was not approved at this time. Please contact your group administrator.',
  },
  suspended: {
    title: 'Account Suspended',
    body: 'Your account has been suspended due to overdue payments. Please contact your group administrator.',
  },
  reinstated: {
    title: 'Account Reinstated ✅',
    body: 'Your account has been reinstated. You now have full access again.',
  },
};

const EMAIL_TEMPLATES = {
  approved: {
    subject: 'Welcome to Excellent Susu — Application Approved',
    html: `<p>Hi {{name}},</p>
<p>Great news! Your membership application has been <strong>approved</strong>. You now have full access to Excellent Susu.</p>
<p>Sign in to view your group, make contributions, and track your payouts.</p>
<p style="margin-top:24px;font-size:12px;color:#6B7280;">Excellent Susu · Community Savings Platform</p>`,
  },
  rejected: {
    subject: 'Excellent Susu — Application Update',
    html: `<p>Hi {{name}},</p>
<p>Thank you for applying to join Excellent Susu. Unfortunately, your application was <strong>not approved</strong> at this time.</p>
<p>Please contact your group administrator for more information.</p>
<p style="margin-top:24px;font-size:12px;color:#6B7280;">Excellent Susu · Community Savings Platform</p>`,
  },
  suspended: {
    subject: 'Excellent Susu — Account Suspended',
    html: `<p>Hi {{name}},</p>
<p>Your Excellent Susu account has been <strong>suspended</strong> due to overdue payments.</p>
<p>Please contact your group administrator to resolve your outstanding payments and reinstate your account.</p>
<p style="margin-top:24px;font-size:12px;color:#6B7280;">Excellent Susu · Community Savings Platform</p>`,
  },
  reinstated: {
    subject: 'Excellent Susu — Account Reinstated',
    html: `<p>Hi {{name}},</p>
<p>Your Excellent Susu account has been <strong>reinstated</strong>. You now have full access again.</p>
<p style="margin-top:24px;font-size:12px;color:#6B7280;">Excellent Susu · Community Savings Platform</p>`,
  },
};

const VALID_ROLES = ['admin', 'manager', 'collector', 'member'];

// Set Firebase Auth Custom Claims for a user so Firestore rules can use
// request.auth.token.role instead of doing an extra document read.
// Only callable by users with the 'admin' custom claim or, on first setup,
// by a manager according to their Firestore doc (bootstrapping path).
exports.syncUserRole = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { targetUserId, role } = request.data;
  if (!targetUserId || !role) throw new HttpsError('invalid-argument', 'targetUserId and role are required.');
  if (!VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', `Invalid role: ${role}`);

  // Caller must be admin (by custom claim) or a manager/admin in Firestore doc.
  const callerClaim = request.auth.token.role;
  const db = getFirestore();
  let callerRole = callerClaim;
  if (!callerRole) {
    const callerSnap = await db.doc(`users/${request.auth.uid}`).get();
    callerRole = callerSnap.exists ? callerSnap.data().role : null;
  }
  if (!['admin', 'manager'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only admins and managers can change roles.');
  }
  // Managers cannot promote to admin.
  if (callerRole === 'manager' && role === 'admin') {
    throw new HttpsError('permission-denied', 'Managers cannot grant admin role.');
  }

  await getAuth().setCustomUserClaims(targetUserId, { role });
  // Also update the Firestore doc so both sources agree.
  await db.doc(`users/${targetUserId}`).update({ role });
  return { ok: true };
});

// Write a tamper-proof audit log entry using the Admin SDK.
// Client-side Firestore rules will deny direct client writes to auditLogs
// once this function is deployed — all entries go through here instead.
exports.writeAuditLog = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { action, targetType, targetId, oldValue, newValue } = request.data || {};
  if (!action) throw new HttpsError('invalid-argument', 'action is required.');

  // Verify caller is staff (not a plain member) — check custom claim then Firestore doc.
  const callerClaim = request.auth.token.role;
  const db = getFirestore();
  let callerRole = callerClaim;
  if (!callerRole) {
    const snap = await db.doc(`users/${request.auth.uid}`).get();
    callerRole = snap.exists ? snap.data().role : null;
  }
  if (!['admin', 'manager', 'collector'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only staff can write audit logs.');
  }

  const entry = {
    id: db.collection('auditLogs').doc().id,
    action,
    targetType: targetType || '',
    targetId: targetId || '',
    actorId: request.auth.uid,
    timestamp: new Date().toISOString(),
    ...(oldValue !== undefined ? { oldValue } : {}),
    ...(newValue !== undefined ? { newValue } : {}),
  };
  await db.collection('auditLogs').doc(entry.id).set(entry);
  return { ok: true, entry };
});

exports.sendStatusNotification = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { userId, status } = request.data;
  if (!userId || !status) throw new HttpsError('invalid-argument', 'userId and status are required.');

  const msg = MESSAGES[status];
  if (!msg) return { ok: false, reason: 'unknown status' };

  const db = getFirestore();
  const snap = await db.doc(`users/${userId}`).get();
  if (!snap.exists) return { ok: false, reason: 'user not found' };

  const { fcmToken } = snap.data();
  if (!fcmToken) return { ok: false, reason: 'no fcm token' };

  let fcmResult = { ok: true };
  try {
    await getMessaging().send({
      token: fcmToken,
      notification: { title: msg.title, body: msg.body },
      data: { type: 'status_change', status },
      webpush: {
        notification: {
          title: msg.title,
          body: msg.body,
          icon: '/logo.jpg',
          badge: '/logo.jpg',
          requireInteraction: true,
        },
        fcm_options: { link: '/' },
      },
    });
  } catch (e) {
    if (
      e.code === 'messaging/registration-token-not-registered' ||
      e.code === 'messaging/invalid-registration-token'
    ) {
      await db.doc(`users/${userId}`).update({ fcmToken: null }).catch(() => {});
      fcmResult = { ok: false, reason: 'stale token cleared' };
    } else {
      console.error('[sendStatusNotification] FCM send failed:', e?.code, e?.message);
      throw new HttpsError('internal', 'Failed to send notification.');
    }
  }

  // Write mail doc for Firebase Trigger Email extension (if installed).
  // The extension picks up docs in the `mail` collection and sends them.
  if (snap.data().email) {
    const name = snap.data().fullName || snap.data().name || 'Member';
    const template = EMAIL_TEMPLATES[status];
    if (template) {
      const html = template.html.replace(/\{\{name\}\}/g, name);
      try {
        await db.collection('mail').add({
          to: snap.data().email,
          message: {
            subject: template.subject,
            html,
          },
        });
      } catch (emailErr) {
        // Non-fatal: extension may not be installed, or mail collection may not exist yet.
        console.warn('[sendStatusNotification] Email write failed (non-fatal):', emailErr?.message);
      }
    }
  }

  return fcmResult;
});
