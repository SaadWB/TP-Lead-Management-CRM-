import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  importCommitSchema,
  USER_ROLES,
  PRIORITIES,
  Priority,
  PipelineStage,
  normalizeCallOutcome,
} from '@crm/shared';
import { leadRepository } from '../../repositories/leadRepository';
import { userRepository } from '../../repositories/userRepository';
import { activityRepository } from '../../repositories/activityRepository';
import { notificationService } from '../../services/notificationService';
import { dbStore } from '../../repositories/dbStore';
import { BadRequestError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';

// Multer memory storage configuration
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.includes('spreadsheetml') ||
      file.mimetype.includes('excel') ||
      file.mimetype.includes('csv') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .xlsx and .csv files are supported.'));
    }
  },
});

export async function parseUploadedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new BadRequestError('The uploaded workbook contains no sheets');
    }

    const selectedSheet = (req.query.sheet as string) || sheetNames[0];
    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
      throw new BadRequestError(`Sheet "${selectedSheet}" not found in workbook`);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (rawRows.length === 0) {
      throw new BadRequestError('The uploaded sheet contains no data rows');
    }

    // Inspect headers
    const headers = Object.keys(rawRows[0] || {});

    // Intelligent column auto-mapping detection
    const normalizedHeaders: Record<string, string> = {};
    headers.forEach((h) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean.includes('company')) normalizedHeaders['companyName'] = h;
      else if (clean.includes('service') || clean.includes('product')) normalizedHeaders['serviceProduct'] = h;
      else if (clean.includes('contact') || clean.includes('person') || clean.includes('name')) normalizedHeaders['contactPerson'] = h;
      else if (clean.includes('phone') && !clean.includes('alt')) normalizedHeaders['phone'] = h;
      else if (clean.includes('altphone')) normalizedHeaders['alternatePhone'] = h;
      else if (clean.includes('email') || clean.includes('mail')) normalizedHeaders['email'] = h;
      else if (clean.includes('priority')) normalizedHeaders['priority'] = h;
      else if (clean.includes('stage') || clean.includes('pipeline')) normalizedHeaders['pipelineStage'] = h;
      else if (clean.includes('callattempt') || clean.includes('attempts')) normalizedHeaders['callAttempts'] = h;
      else if (clean.includes('outcome')) normalizedHeaders['lastCallOutcome'] = h;
      else if (clean.includes('lastcontact')) normalizedHeaders['lastContactDate'] = h;
      else if (clean.includes('nextfollow') || clean.includes('followup')) normalizedHeaders['nextFollowUpDate'] = h;
      else if (clean.includes('nextaction') || clean.includes('action')) normalizedHeaders['nextAction'] = h;
      else if (clean.includes('note') || clean.includes('objection')) normalizedHeaders['notes'] = h;
      else if (clean.includes('website') || clean.includes('web')) normalizedHeaders['website'] = h;
      else if (clean.includes('city')) normalizedHeaders['city'] = h;
      else if (clean.includes('state')) normalizedHeaders['state'] = h;
      else if (clean.includes('source')) normalizedHeaders['leadSource'] = h;
    });

    sendSuccess(res, {
      fileName: req.file.originalname,
      sheetNames,
      selectedSheet,
      totalRows: rawRows.length,
      headers,
      suggestedMapping: normalizedHeaders,
      previewRows: rawRows.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
}

export async function validateAndReviewImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rows, columnMapping } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError('Rows must be an array of objects');
    }

    const existingLeads = dbStore.store.leads;
    const cleanPhone = (p: string) => (p || '').toString().replace(/\D/g, '');

    const validatedRows: any[] = [];
    const duplicates: any[] = [];
    const seenPhonesInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();

    let validCount = 0;
    let invalidCount = 0;

    rows.forEach((row, idx) => {
      const getField = (fieldKey: string) => {
        const col = columnMapping[fieldKey];
        return col !== undefined && row[col] !== undefined ? String(row[col]).trim() : '';
      };

      const companyName = getField('companyName');
      const serviceProduct = getField('serviceProduct');
      const contactPerson = getField('contactPerson');
      const phone = getField('phone');
      const email = getField('email');
      const priority = (getField('priority').toUpperCase() || 'MEDIUM') as Priority;
      const pipelineStage = (getField('pipelineStage').toUpperCase() || 'NEW') as PipelineStage;
      const notes = getField('notes');
      const nextAction = getField('nextAction');
      const nextFollowUpDate = getField('nextFollowUpDate');
      const callAttempts = parseInt(getField('callAttempts') || '0', 10) || 0;
      const lastCallOutcome = getField('lastCallOutcome') || null;
      const website = getField('website') || null;
      const city = getField('city') || null;
      const state = getField('state') || null;
      const leadSource = getField('leadSource') || 'Spreadsheet Import';

      const errors: string[] = [];
      if (!companyName) errors.push('Company name is required');
      if (!contactPerson) errors.push('Contact person is required');
      if (!phone) errors.push('Phone number is required');
      else if (cleanPhone(phone).length < 7) errors.push('Phone number must have at least 7 digits');

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Malformed email address format');
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      // Check duplicates against existing DB
      const phoneDigits = cleanPhone(phone);
      let duplicateMatch: any = null;
      let matchingReason = '';

      if (phoneDigits) {
        const dbMatch = existingLeads.find(
          (l) => cleanPhone(l.phone).endsWith(phoneDigits) || phoneDigits.endsWith(cleanPhone(l.phone))
        );
        if (dbMatch) {
          duplicateMatch = dbMatch;
          matchingReason = `Phone number matches existing lead "${dbMatch.companyName}" (${dbMatch.phone})`;
        }
      }

      if (!duplicateMatch && email) {
        const dbMatch = existingLeads.find(
          (l) => l.email && l.email.toLowerCase() === email.toLowerCase()
        );
        if (dbMatch) {
          duplicateMatch = dbMatch;
          matchingReason = `Email matches existing lead "${dbMatch.companyName}" (${dbMatch.email})`;
        }
      }

      // Check duplicate within the uploaded file itself
      if (phoneDigits && seenPhonesInBatch.has(phoneDigits)) {
        matchingReason = `Duplicate phone number within this uploaded file`;
      }
      if (email && seenEmailsInBatch.has(email.toLowerCase())) {
        matchingReason = `Duplicate email within this uploaded file`;
      }

      if (phoneDigits) seenPhonesInBatch.add(phoneDigits);
      if (email) seenEmailsInBatch.add(email.toLowerCase());

      const rowItem = {
        rowIndex: idx + 1,
        rawData: row,
        mapped: {
          companyName,
          serviceProduct: serviceProduct || 'General Procurement',
          contactPerson,
          phone,
          email: email || null,
          priority: (Object.values(PRIORITIES) as string[]).includes(priority) ? priority : 'MEDIUM',
          pipelineStage: normalizeCallOutcome(pipelineStage),
          callAttempts,
          lastCallOutcome,
          nextFollowUpDate: nextFollowUpDate || null,
          nextAction: nextAction || null,
          notes: notes || null,
          website,
          city,
          state,
          leadSource,
        },
        errors,
        isValid,
        hasDuplicate: !!duplicateMatch || !!matchingReason,
        duplicateMatch: duplicateMatch
          ? {
              id: duplicateMatch.id,
              companyName: duplicateMatch.companyName,
              contactPerson: duplicateMatch.contactPerson,
              phone: duplicateMatch.phone,
              email: duplicateMatch.email,
              pipelineStage: duplicateMatch.pipelineStage,
              telecallerName: duplicateMatch.assignedTelecaller?.name,
            }
          : null,
        matchingReason,
      };

      validatedRows.push(rowItem);

      if (duplicateMatch || matchingReason) {
        duplicates.push({
          tempRowId: `row_${idx + 1}`,
          uploadedRecord: {
            companyName,
            contactPerson,
            phone,
            email,
            serviceProduct,
          },
          existingRecord: duplicateMatch
            ? {
                id: duplicateMatch.id,
                companyName: duplicateMatch.companyName,
                contactPerson: duplicateMatch.contactPerson,
                phone: duplicateMatch.phone,
                email: duplicateMatch.email,
                pipelineStage: duplicateMatch.pipelineStage,
              }
            : null,
          matchingReason,
          recommendedAction: 'SKIP',
          selectedAction: 'SKIP',
        });
      }
    });

    sendSuccess(res, {
      totalRows: rows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicates.length,
      validatedRows,
      duplicates,
    });
  } catch (error) {
    next(error);
  }
}

export async function commitImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = importCommitSchema.parse(req.body);
    const { fileName, records, distributionMethod, selectedTelecallerIds } = data;

    // Filter telecallers
    let telecallerPool: string[] = [];
    if (selectedTelecallerIds && selectedTelecallerIds.length > 0) {
      telecallerPool = selectedTelecallerIds;
    } else {
      const activeTelecallers = await userRepository.findAll({ role: USER_ROLES.TELECALLER, isActive: true });
      telecallerPool = activeTelecallers.map((t) => t.id);
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const telecallerCounts: Record<string, number> = {};
    telecallerPool.forEach((id) => (telecallerCounts[id] = 0));

    let roundRobinIdx = 0;

    for (const record of records) {
      if (record.action === 'SKIP') {
        skippedCount++;
        continue;
      }

      if (record.action === 'UPDATE' && record.matchedExistingId) {
        // Update existing lead without overwriting history
        const existing = await leadRepository.findById(record.matchedExistingId);
        if (existing) {
          await leadRepository.update(existing.id, {
            serviceProduct: record.serviceProduct || existing.serviceProduct,
            contactPerson: record.contactPerson || existing.contactPerson,
            notes: record.notes ? `${existing.notes || ''}\n[Import Update]: ${record.notes}` : existing.notes,
            lastActivityAt: new Date().toISOString(),
          });
          await activityRepository.create({
            leadId: existing.id,
            userId: req.user!.id,
            type: 'LEAD_IMPORTED',
            description: `Lead updated from bulk import file "${fileName}" by ${req.user!.name}`,
          });
          updatedCount++;
          continue;
        }
      }

      // Assign telecaller
      let assignedTelecallerId = record.assignedTelecallerId;
      if (!assignedTelecallerId && telecallerPool.length > 0) {
        if (distributionMethod === 'EVEN') {
          assignedTelecallerId = telecallerPool[roundRobinIdx % telecallerPool.length];
          roundRobinIdx++;
        } else {
          assignedTelecallerId = telecallerPool[0];
        }
      }

      if (assignedTelecallerId) {
        telecallerCounts[assignedTelecallerId] = (telecallerCounts[assignedTelecallerId] || 0) + 1;
      }

      const created = await leadRepository.create({
        companyName: record.companyName,
        serviceProduct: record.serviceProduct,
        contactPerson: record.contactPerson,
        phone: record.phone,
        email: record.email || null,
        alternatePhone: record.alternatePhone || null,
        website: record.website || null,
        city: record.city || null,
        state: record.state || null,
        priority: (record.priority as Priority) || 'MEDIUM',
        pipelineStage: (record.pipelineStage as PipelineStage) || 'NEW',
        callAttempts: record.callAttempts || 0,
        lastCallOutcome: (record.lastCallOutcome as any) || null,
        lastContactDate: record.lastContactDate || null,
        nextFollowUpDate: record.nextFollowUpDate || null,
        nextAction: record.nextAction || null,
        notes: record.notes || null,
        leadSource: record.leadSource || 'Bulk Import',
        assignedTelecallerId: assignedTelecallerId || null,
        createdById: req.user!.id,
      });

      // Assignment history
      if (assignedTelecallerId) {
        dbStore.store.assignmentHistories.push({
          id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          leadId: created.id,
          assignedById: req.user!.id,
          previousUserId: null,
          newUserId: assignedTelecallerId,
          roleType: 'TELECALLER',
          handoverSummary: `Assigned during bulk import "${fileName}"`,
          createdAt: new Date().toISOString(),
        });
      }

      // Activity record
      await activityRepository.create({
        leadId: created.id,
        userId: req.user!.id,
        type: 'LEAD_IMPORTED',
        description: `Imported via spreadsheet "${fileName}" by ${req.user!.name}`,
      });

      importedCount++;
    }

    // Notify assigned telecallers
    for (const [telecallerId, count] of Object.entries(telecallerCounts)) {
      if (count > 0) {
        await notificationService.notifyLeadAssignment(
          telecallerId,
          'import-batch',
          `${count} New Leads (Batch Import)`,
          'Import Distribution',
          req.user!.name
        );
      }
    }

    sendSuccess(res, {
      fileName,
      totalProcessed: records.length,
      importedCount,
      updatedCount,
      skippedCount,
      distribution: Object.entries(telecallerCounts).map(([telecallerId, count]) => {
        const u = dbStore.store.users.find((user) => user.id === telecallerId);
        return { telecallerId, name: u ? u.name : telecallerId, count };
      }),
    });
  } catch (error) {
    next(error);
  }
}
