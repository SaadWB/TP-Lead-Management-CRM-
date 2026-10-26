const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../../../.data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const BACKUP_FILE = path.join(DATA_DIR, `store.backup-round7-${Date.now()}.json`);
const SAFE_PRIMARY_BACKUP = path.join(DATA_DIR, 'store.backup-round7.json');

function runRound7Migration() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('[Migration Round 7] store.json does not exist. Skipping migration.');
    return { migratedLeads: 0, backupPath: '' };
  }

  // 1. Create a safe backup before migrating
  if (!fs.existsSync(SAFE_PRIMARY_BACKUP)) {
    fs.copyFileSync(DATA_FILE, SAFE_PRIMARY_BACKUP);
    console.log(`[Migration Round 7] Created primary backup at: ${SAFE_PRIMARY_BACKUP}`);
  }
  fs.copyFileSync(DATA_FILE, BACKUP_FILE);
  console.log(`[Migration Round 7] Created timestamped backup at: ${BACKUP_FILE}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const store = JSON.parse(raw);

  const now = new Date().toISOString();
  let migratedCount = 0;

  if (Array.isArray(store.leads)) {
    for (const lead of store.leads) {
      const oldStage = lead.pipelineStage || '';
      const oldOutcome = lead.lastCallOutcome || '';
      let newPipeline = lead.pipelineStage;
      let newOutcome = lead.lastCallOutcome;
      let noteToAppend = '';

      // Determine mapping
      const combined = (oldOutcome || oldStage || '').trim();

      if (combined === 'New Lead' || combined === 'NEW') {
        newPipeline = 'New Lead';
        newOutcome = null;
      } else if (combined === 'No Answer / Ringing' || combined === 'No Answer' || combined === 'NO_ANSWER') {
        newPipeline = 'Attempting Contact';
        newOutcome = 'No Answer';
      } else if (combined === 'Busy / Declined' || combined === 'Busy' || combined === 'BUSY') {
        newPipeline = 'Follow-up';
        newOutcome = 'Busy';
      } else if (combined === 'Call Cut') {
        newPipeline = 'Attempting Contact';
        newOutcome = 'Call Cut';
      } else if (combined === 'Callback Requested' || combined === 'Call Back Later' || combined === 'CALL_BACK_REQUESTED') {
        newPipeline = 'Follow-up';
        newOutcome = 'Call Back Later';
      } else if (combined === 'Details on WhatsApp' || combined === 'Details Requested') {
        newPipeline = 'Follow-up';
        newOutcome = 'Details Requested';
      } else if (combined === 'Demo Requested' || combined === 'Demo Interested') {
        newPipeline = 'Follow-up';
        newOutcome = 'Demo Interested';
      } else if (combined === 'Demo Scheduled') {
        newPipeline = 'Demo';
        newOutcome = 'Demo Scheduled';
      } else if (combined === 'Demo Completed') {
        newPipeline = 'Follow-up';
        newOutcome = 'Demo Completed';
      } else if (combined === 'Decision Pending') {
        newPipeline = 'Follow-up';
        newOutcome = 'Decision Pending';
      } else if (
        combined === 'Interested' ||
        combined === 'Discussing' ||
        combined === 'Interested, Discussing' ||
        combined === 'Connected – Discussed' ||
        combined === 'Connected - Discussed'
      ) {
        newPipeline = 'Connected';
        newOutcome = 'Connected – Discussed';
      } else if (combined === 'Not Interested' || combined === 'NOT_INTERESTED') {
        newPipeline = 'Closed';
        newOutcome = 'Not Interested';
      } else if (combined === 'Invalid / Wrong Number' || combined === 'Wrong Number' || combined === 'INVALID_CONTACT') {
        newPipeline = 'Closed';
        newOutcome = 'Wrong Number';
      } else if (combined === 'Do Not Contact' || combined === 'DNC') {
        newPipeline = 'Closed';
        newOutcome = 'Not Interested';
        noteToAppend = 'Do Not Contact';
      } else if (combined === 'Closed' || combined === 'CONVERTED') {
        newPipeline = 'Closed';
        newOutcome = oldOutcome || 'Closed';
      } else if (combined === 'Assign to Salesman' || combined === 'ASSIGNED_TO_SALESMAN') {
        newPipeline = lead.salesStage === 'DEMO_SCHEDULED' ? 'Demo' : 'Follow-up';
        newOutcome = 'Connected – Discussed';
      }

      const changed = newPipeline !== oldStage || newOutcome !== oldOutcome || !!noteToAppend;
      if (changed) {
        lead.pipelineStage = newPipeline;
        lead.lastCallOutcome = newOutcome;
        lead.lastStatusUpdatedAt = now;

        if (noteToAppend) {
          lead.notes = lead.notes ? `${lead.notes}\n[Migration]: ${noteToAppend}` : `[Migration]: ${noteToAppend}`;
        }

        // Record history note for converted lead
        if (!Array.isArray(store.activities)) {
          store.activities = [];
        }
        store.activities.push({
          id: `act_mig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          leadId: lead.id,
          userId: 'usr_admin_1',
          type: 'STAGE_CHANGED',
          description: `Round 7 Data Migration: Updated pipeline to "${newPipeline}" and last call outcome to "${newOutcome || 'None'}".`,
          metadata: {
            migratedFrom: { oldStage, oldOutcome },
            migratedTo: { newPipeline, newOutcome },
            noteAppended: noteToAppend || null,
          },
          createdAt: now,
        });

        migratedCount++;
      }
    }
  }

  // Migrate callLogs outcomes
  if (Array.isArray(store.callLogs)) {
    for (const cl of store.callLogs) {
      if (cl.outcome === 'No Answer / Ringing') cl.outcome = 'No Answer';
      else if (cl.outcome === 'Busy / Declined') cl.outcome = 'Busy';
      else if (cl.outcome === 'Callback Requested') cl.outcome = 'Call Back Later';
      else if (cl.outcome === 'Details on WhatsApp') cl.outcome = 'Details Requested';
      else if (cl.outcome === 'Demo Requested') cl.outcome = 'Demo Interested';
      else if (cl.outcome === 'Interested' || cl.outcome === 'Discussing') cl.outcome = 'Connected – Discussed';
      else if (cl.outcome === 'Invalid / Wrong Number') cl.outcome = 'Wrong Number';
      else if (cl.outcome === 'Do Not Contact') cl.outcome = 'Not Interested';
    }
  }

  // Update default custom options
  if (!store.customOptions) {
    store.customOptions = { priorities: [], callOutcomes: [] };
  }
  store.customOptions.callOutcomes = (store.customOptions.callOutcomes || []).map((o) => {
    if (o === 'No Answer / Ringing') return 'No Answer';
    if (o === 'Busy / Declined') return 'Busy';
    if (o === 'Callback Requested') return 'Call Back Later';
    if (o === 'Details on WhatsApp') return 'Details Requested';
    if (o === 'Demo Requested') return 'Demo Interested';
    if (o === 'Interested' || o === 'Discussing') return 'Connected – Discussed';
    if (o === 'Invalid / Wrong Number') return 'Wrong Number';
    if (o === 'Do Not Contact') return 'Not Interested';
    return o;
  }).filter((o) => o && o.trim().toLowerCase() !== 'special inquiry');

  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`[Migration Round 7] Successfully migrated ${migratedCount} leads.`);

  return { migratedLeads: migratedCount, backupPath: BACKUP_FILE };
}

runRound7Migration();
