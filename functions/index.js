const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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

// ── Private helpers ──────────────────────────────────────────────────────────

// Resolve the caller's role from custom claim, falling back to Firestore doc.
async function resolveCallerRole(db, auth) {
  const claimRole = auth.token.role;
  if (claimRole) return claimRole;
  const snap = await db.doc(`users/${auth.uid}`).get();
  return snap.exists ? snap.data().role : null;
}

// Send FCM + in-app notification + email for a status change event.
async function notifyUser(db, userId, status) {
  const msg = MESSAGES[status];
  if (!msg) return;

  const snap = await db.doc(`users/${userId}`).get();
  if (!snap.exists) return;
  const userData = snap.data();
  const now = new Date().toISOString();

  // FCM push
  if (userData.fcmToken) {
    try {
      await getMessaging().send({
        token: userData.fcmToken,
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
      } else {
        console.warn(`[notifyUser] FCM send failed for ${userId}:`, e?.code, e?.message);
      }
    }
  }

  // In-app notification doc
  await db.collection('notifications').add({
    userId,
    title: msg.title,
    text: msg.body,
    message: msg.body,
    type: 'info',
    read: false,
    date: now.split('T')[0],
    sent: now,
  });

  // Email via Firebase Trigger Email extension (non-fatal if not installed)
  const template = EMAIL_TEMPLATES[status];
  if (template && userData.email) {
    const name = userData.fullName || userData.name || 'Member';
    const html = template.html.replace(/\{\{name\}\}/g, name);
    await db.collection('mail').add({
      to: userData.email,
      message: { subject: template.subject, html },
    }).catch(e => console.warn('[notifyUser] Email write failed (non-fatal):', e?.message));
  }
}

// Write a tamper-proof audit log entry via the Admin SDK.
async function writeAuditEntry(db, actorId, action, targetType, targetId, oldValue, newValue) {
  const entry = {
    id: db.collection('auditLogs').doc().id,
    action,
    targetType: targetType || '',
    targetId: targetId || '',
    actorId,
    timestamp: new Date().toISOString(),
    ...(oldValue !== undefined ? { oldValue } : {}),
    ...(newValue !== undefined ? { newValue } : {}),
  };
  await db.collection('auditLogs').doc(entry.id).set(entry);
  return entry;
}

// Sliding-window rate limiter backed by a Firestore transaction.
// Returns true if the request is within limits, false if exceeded.
async function checkRateLimit(db, uid, action, limit = 20, windowMs = 60000) {
  const limitRef = db.doc(`_rateLimits/${uid}_${action}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(limitRef);
    const now = Date.now();
    const calls = (snap.exists ? snap.data().calls || [] : []).filter(t => now - t < windowMs);
    if (calls.length >= limit) return false;
    calls.push(now);
    tx.set(limitRef, { calls, updatedAt: now });
    return true;
  });
}

// ── Scheduled: mark pending payments as overdue ──────────────────────────────

// Runs daily at 01:00 UTC. Queries all pending payments past their dueDate
// and flips them to 'overdue' in a single batch write.
exports.scheduledMarkOverdue = onSchedule(
  { schedule: '0 1 * * *', region: 'us-central1', timeZone: 'UTC' },
  async () => {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];

    const snap = await db.collection('payments')
      .where('status', '==', 'pending')
      .where('dueDate', '<', today)
      .get();

    if (snap.empty) {
      console.log('[scheduledMarkOverdue] No overdue payments found.');
      return;
    }

    const batch = db.batch();
    const now = new Date().toISOString();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'overdue', updatedAt: now });
    });
    await batch.commit();
    console.log(`[scheduledMarkOverdue] Marked ${snap.size} payment(s) as overdue.`);
  }
);

// ── Scheduled: auto-suspend members with 3+ overdue payments ────────────────

// Runs daily at 02:00 UTC. Finds members with ≥ 3 overdue payments,
// suspends them, removes them from all group member arrays, and sends
// an FCM + in-app notification.
exports.scheduledAutoSuspension = onSchedule(
  { schedule: '0 2 * * *', region: 'us-central1', timeZone: 'UTC' },
  async () => {
    const db = getFirestore();

    // Aggregate overdue payments per user
    const snap = await db.collection('payments').where('status', '==', 'overdue').get();
    const overdueCounts = {};
    snap.docs.forEach(doc => {
      const { userId } = doc.data();
      if (userId) overdueCounts[userId] = (overdueCounts[userId] || 0) + 1;
    });

    const eligible = Object.entries(overdueCounts)
      .filter(([, count]) => count >= 3)
      .map(([userId]) => userId);

    if (eligible.length === 0) {
      console.log('[scheduledAutoSuspension] No members eligible for suspension.');
      return;
    }

    for (const userId of eligible) {
      const userSnap = await db.doc(`users/${userId}`).get();
      if (!userSnap.exists) continue;
      const userData = userSnap.data();
      // Skip admins and already-suspended accounts
      if (userData.status === 'suspended' || userData.role === 'admin') continue;

      const now = new Date().toISOString();
      await db.doc(`users/${userId}`).update({ status: 'suspended', updatedAt: now });

      // Remove from all groups
      const groupsSnap = await db.collection('groups')
        .where('members', 'array-contains', userId)
        .get();
      if (!groupsSnap.empty) {
        const batch = db.batch();
        groupsSnap.docs.forEach(doc => {
          batch.update(doc.ref, { members: FieldValue.arrayRemove(userId) });
        });
        await batch.commit();
      }

      await Promise.allSettled([
        notifyUser(db, userId, 'suspended'),
        writeAuditEntry(db, 'system', 'auto_suspend', 'user', userId,
          { status: userData.status },
          { status: 'suspended', reason: `${overdueCounts[userId]} overdue payments` }
        ),
      ]);

      console.log(`[scheduledAutoSuspension] Suspended ${userId} (${overdueCounts[userId]} overdue).`);
    }
  }
);

// ── submitPayment: rate-limited, server-validated payment submission ─────────

// Callable by members only. Enforces:
//   - Sliding-window rate limit: 20 submissions per minute per user
//   - Caller is an active group member (not suspended)
//   - Amount matches the group's expected contributionAmount (± 0.01)
exports.submitPayment = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { groupId, amount, note } = request.data || {};
  if (!groupId) throw new HttpsError('invalid-argument', 'groupId is required.');
  if (typeof amount !== 'number' || amount <= 0) {
    throw new HttpsError('invalid-argument', 'amount must be a positive number.');
  }

  const db = getFirestore();
  const uid = request.auth.uid;

  // Rate limit check
  const allowed = await checkRateLimit(db, uid, 'submitPayment', 20, 60000);
  if (!allowed) {
    throw new HttpsError('resource-exhausted', 'Too many payment submissions. Try again in a minute.');
  }

  // Caller must exist and not be suspended
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  if (userSnap.data().status === 'suspended') {
    throw new HttpsError('permission-denied', 'Your account is suspended.');
  }

  // Group must exist and caller must be a member
  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists) throw new HttpsError('not-found', 'Group not found.');
  const groupData = groupSnap.data();
  const members = (groupData.members || []).map(String);
  if (!members.includes(String(uid))) {
    throw new HttpsError('permission-denied', 'You are not a member of this group.');
  }

  // Validate amount against the group's expected contribution
  const expected = groupData.contributionAmount ?? groupData.contribution;
  if (expected != null && Math.abs(amount - expected) > 0.01) {
    throw new HttpsError(
      'invalid-argument',
      `Expected contribution amount is ${expected}. Submitted: ${amount}.`
    );
  }

  const now = new Date().toISOString();
  const paymentRef = db.collection('payments').doc();
  const payment = {
    id: paymentRef.id,
    userId: uid,
    groupId,
    amount,
    status: 'pending',
    note: note || '',
    date: now.split('T')[0],
    dueDate: now.split('T')[0],
    createdAt: now,
    updatedAt: now,
  };

  await paymentRef.set(payment);
  return { ok: true, payment };
});

// ── Member management callables ──────────────────────────────────────────────

exports.approveMember = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { targetUserId } = request.data || {};
  if (!targetUserId) throw new HttpsError('invalid-argument', 'targetUserId is required.');

  const db = getFirestore();
  const callerRole = await resolveCallerRole(db, request.auth);
  if (!['admin', 'manager'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only managers and admins can approve members.');
  }

  const userSnap = await db.doc(`users/${targetUserId}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const userData = userSnap.data();

  if (userData.status === 'active') return { ok: true, alreadyActive: true };

  const role = VALID_ROLES.includes(userData.role) ? userData.role : 'member';
  const now = new Date().toISOString();

  await db.doc(`users/${targetUserId}`).update({ status: 'active', updatedAt: now });

  // Sync custom claim so Firestore rules use the fast claim path
  await getAuth().setCustomUserClaims(targetUserId, { role });

  await Promise.allSettled([
    notifyUser(db, targetUserId, 'approved'),
    writeAuditEntry(db, request.auth.uid, 'approve_member', 'user', targetUserId,
      { status: userData.status },
      { status: 'active' }
    ),
  ]);

  return { ok: true };
});

exports.rejectMember = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { targetUserId } = request.data || {};
  if (!targetUserId) throw new HttpsError('invalid-argument', 'targetUserId is required.');

  const db = getFirestore();
  const callerRole = await resolveCallerRole(db, request.auth);
  if (!['admin', 'manager'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only managers and admins can reject members.');
  }

  const userSnap = await db.doc(`users/${targetUserId}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const userData = userSnap.data();
  const now = new Date().toISOString();

  await db.doc(`users/${targetUserId}`).update({ status: 'rejected', updatedAt: now });

  await Promise.allSettled([
    notifyUser(db, targetUserId, 'rejected'),
    writeAuditEntry(db, request.auth.uid, 'reject_member', 'user', targetUserId,
      { status: userData.status },
      { status: 'rejected' }
    ),
  ]);

  return { ok: true };
});

exports.suspendMember = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { targetUserId } = request.data || {};
  if (!targetUserId) throw new HttpsError('invalid-argument', 'targetUserId is required.');

  const db = getFirestore();
  const callerRole = await resolveCallerRole(db, request.auth);
  if (!['admin', 'manager'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only managers and admins can suspend members.');
  }

  const userSnap = await db.doc(`users/${targetUserId}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const userData = userSnap.data();

  if (userData.status === 'suspended') return { ok: true, alreadySuspended: true };
  if (userData.role === 'admin') {
    throw new HttpsError('permission-denied', 'Cannot suspend an admin account.');
  }

  const now = new Date().toISOString();
  await db.doc(`users/${targetUserId}`).update({ status: 'suspended', updatedAt: now });

  // Remove the user from every group they belong to
  const groupsSnap = await db.collection('groups')
    .where('members', 'array-contains', targetUserId)
    .get();
  if (!groupsSnap.empty) {
    const batch = db.batch();
    groupsSnap.docs.forEach(doc => {
      batch.update(doc.ref, { members: FieldValue.arrayRemove(targetUserId) });
    });
    await batch.commit();
  }

  await Promise.allSettled([
    notifyUser(db, targetUserId, 'suspended'),
    writeAuditEntry(db, request.auth.uid, 'suspend_member', 'user', targetUserId,
      { status: userData.status },
      { status: 'suspended' }
    ),
  ]);

  return { ok: true };
});

exports.reinstateMember = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { targetUserId } = request.data || {};
  if (!targetUserId) throw new HttpsError('invalid-argument', 'targetUserId is required.');

  const db = getFirestore();
  const callerRole = await resolveCallerRole(db, request.auth);
  if (!['admin', 'manager'].includes(callerRole)) {
    throw new HttpsError('permission-denied', 'Only managers and admins can reinstate members.');
  }

  const userSnap = await db.doc(`users/${targetUserId}`).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const userData = userSnap.data();

  if (userData.status !== 'suspended') return { ok: true, notSuspended: true };

  const role = VALID_ROLES.includes(userData.role) ? userData.role : 'member';
  const now = new Date().toISOString();

  await db.doc(`users/${targetUserId}`).update({ status: 'active', updatedAt: now });

  // Re-sync custom claim so rules immediately reflect active status
  await getAuth().setCustomUserClaims(targetUserId, { role });

  await Promise.allSettled([
    notifyUser(db, targetUserId, 'reinstated'),
    writeAuditEntry(db, request.auth.uid, 'reinstate_member', 'user', targetUserId,
      { status: 'suspended' },
      { status: 'active' }
    ),
  ]);

  return { ok: true };
});

// ── sendStatusNotification (existing — kept for backward compatibility) ──────

exports.syncUserRole = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { targetUserId, role } = request.data;
  if (!targetUserId || !role) throw new HttpsError('invalid-argument', 'targetUserId and role are required.');
  if (!VALID_ROLES.includes(role)) throw new HttpsError('invalid-argument', `Invalid role: ${role}`);

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
  if (callerRole === 'manager' && role === 'admin') {
    throw new HttpsError('permission-denied', 'Managers cannot grant admin role.');
  }

  await getAuth().setCustomUserClaims(targetUserId, { role });
  await db.doc(`users/${targetUserId}`).update({ role });
  return { ok: true };
});

exports.writeAuditLog = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { action, targetType, targetId, oldValue, newValue } = request.data || {};
  if (!action) throw new HttpsError('invalid-argument', 'action is required.');

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

  const entry = await writeAuditEntry(
    db, request.auth.uid, action, targetType, targetId, oldValue, newValue
  );
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

  if (snap.data().email) {
    const name = snap.data().fullName || snap.data().name || 'Member';
    const template = EMAIL_TEMPLATES[status];
    if (template) {
      const html = template.html.replace(/\{\{name\}\}/g, name);
      try {
        await db.collection('mail').add({
          to: snap.data().email,
          message: { subject: template.subject, html },
        });
      } catch (emailErr) {
        console.warn('[sendStatusNotification] Email write failed (non-fatal):', emailErr?.message);
      }
    }
  }

  return fcmResult;
});
