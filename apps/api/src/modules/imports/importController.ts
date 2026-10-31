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
import { auditLogRepository } from '../../repositories/auditLogRepository';
import { dbStore } from '../../repositories/dbStore';
import { BadRequestError, ForbiddenError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { sanitizeForFormulaInjection } from '../../utils/security';

// Configure Multer for in-memory processing
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max file size
  fileFilter: (_req, file, cb) => {
    const isAllowed =
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel') ||
      file.mimetype.includes('csv') ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.csv');

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .xlsx and .csv files are supported.'));
    }
  },
});

export async function parseUploadedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new BadRequestError('Please provide a spreadsheet or CSV file');
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      throw new BadRequestError('The uploaded file does not contain any readable sheets');
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

    if (rawRows.length > 500) {
      throw new BadRequestError('File contains more than 500 rows. Please cap bulk upload batches to 500 records.');
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
      else if (clean.includes('source')) normalizedHeaders['leadSource'] = h;
      else if (clean.includes('priority')) normalizedHeaders['priority'] = h;
      else if (clean.includes('stage') || clean.includes('pipeline')) normalizedHeaders['pipelineStage'] = h;
      else if (clean.includes('callattempt') || clean.includes('attempts')) normalizedHeaders['callAttempts'] = h;
      else if (clean.includes('outcome')) normalizedHeaders['lastCallOutcome'] = h;
      else if (clean.includes('lastcontact')) normalizedHeaders['lastContactDate'] = h;
      else if (clean.includes('nextfollow') || clean.includes('followup')) normalizedHeaders['nextFollowUpDate'] = h;
      else if (clean.includes('nextaction') || clean.includes('action')) normalizedHeaders['nextAction'] = h;
      else if (clean.includes('note') || clean.includes('objection')) normalizedHeaders['notes'] = h;
      else if (clean.includes('website') || clean.includes('web')) normalizedHeaders['website'] = h;
      // Note: city and state from old templates are ignored silently
    });

    sendSuccess(res, {
      fileName: req.file.originalname,
      sheetNames,
      selectedSheet,
      totalRows: rawRows.length,
      headers,
      suggestedMapping: normalizedHeaders,
      previewRows: rawRows.slice(0, 10).map((r) => sanitizeForFormulaInjection(r)),
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

    if (rows.length > 500) {
      throw new BadRequestError('Cannot validate more than 500 rows per batch.');
    }

    const existingLeads = dbStore.store.leads;
    const cleanPhone = (p: string) => (p || '').toString().replace(/\D/g, '');
    const activeSources = (dbStore.store.leadSourceOptions || []).filter((s) => s.isActive);

    const validatedRows: any[] = [];
    const duplicates: any[] = [];
    const seenPhonesInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();

    let validCount = 0;
    let invalidCount = 0;

    rows.forEach((row, idx) => {
      const getField = (fieldKey: string) => {
        const col = columnMapping[fieldKey];
        const val = col !== undefined && row[col] !== undefined ? String(row[col]).trim() : '';
        return sanitizeForFormulaInjection(val);
      };

      const companyName = getField('companyName');
      const serviceProduct = getField('serviceProduct');
      const contactPerson = getField('contactPerson'); // Optional!
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

      // Lead Source mapping:
      const rawSource = getField('leadSource');
      let leadSource = '';
      let leadSourceOther = '';
      let sourceWarning: string | null = null;

      if (rawSource) {
        const matched = activeSources.find(
          (s) => s.name.toLowerCase() === rawSource.toLowerCase()
        );
        if (matched) {
          leadSource = matched.name;
        } else {
          leadSource = 'Other';
          leadSourceOther = rawSource.slice(0, 100);
          sourceWarning = `Source "${rawSource}" not recognized; mapped to "Other" ("${leadSourceOther}")`;
        }
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      if (sourceWarning) warnings.push(sourceWarning);

      if (!companyName) errors.push('Company name is required');
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
          contactPerson: contactPerson || '',
          phone,
          email: email || null,
          priority: (Object.values(PRIORITIES) as string[]).includes(priority) ? priority : 'MEDIUM',
          pipelineStage: normalizeCallOutcome(pipelineStage) || 'New Lead',
          callAttempts,
          lastCallOutcome,
          nextFollowUpDate: nextFollowUpDate || null,
          nextAction: nextAction || null,
          notes: notes || null,
          website,
          leadSource: leadSource || null,
          leadSourceOther: leadSourceOther || null,
        },
        errors,
        warnings,
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
    if (req.user!.role !== USER_ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Only Super Admin can commit bulk imports.');
    }

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
            leadSource: record.leadSource || existing.leadSource,
            leadSourceOther: record.leadSourceOther || existing.leadSourceOther,
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
      let assignedId: string | null = null;
      if (distributionMethod === 'EVEN' && telecallerPool.length > 0) {
        assignedId = telecallerPool[roundRobinIdx % telecallerPool.length];
        roundRobinIdx++;
        telecallerCounts[assignedId] = (telecallerCounts[assignedId] || 0) + 1;
      } else if (record.assignedTelecallerId) {
        assignedId = record.assignedTelecallerId;
      }

      const newLead = await leadRepository.create({
        companyName: record.companyName,
        serviceProduct: record.serviceProduct,
        contactPerson: record.contactPerson || '',
        phone: record.phone,
        email: record.email || null,
        alternatePhone: record.alternatePhone || null,
        website: record.website || null,
        priority: record.priority as Priority,
        pipelineStage: (record.pipelineStage as PipelineStage) || 'New Lead',
        callAttempts: record.callAttempts || 0,
        lastCallOutcome: record.lastCallOutcome || null,
        lastContactDate: record.lastContactDate || null,
        nextFollowUpDate: record.nextFollowUpDate || null,
        nextAction: record.nextAction || null,
        notes: record.notes || null,
        leadSource: record.leadSource || null,
        leadSourceOther: record.leadSourceOther || null,
        assignedTelecallerId: assignedId,
        createdById: req.user!.id,
      });

      await activityRepository.create({
        leadId: newLead.id,
        userId: req.user!.id,
        type: 'LEAD_IMPORTED',
        description: `Lead imported from file "${fileName}" by ${req.user!.name}`,
      });

      importedCount++;
    }

    await auditLogRepository.create({
      userId: req.user!.id,
      action: 'BULK_IMPORT',
      entity: 'IMPORT_JOB',
      details: {
        fileName,
        importedCount,
        updatedCount,
        skippedCount,
        distributionMethod,
      },
    });

    sendSuccess(res, {
      fileName,
      totalProcessed: records.length,
      importedCount,
      updatedCount,
      skippedCount,
      telecallerDistribution: telecallerCounts,
    });
  } catch (error) {
    next(error);
  }
}
