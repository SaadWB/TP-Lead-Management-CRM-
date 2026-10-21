'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { api } from '@/lib/apiClient';
import { User, IMPORT_TEMPLATE_COLUMNS } from '@crm/shared';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Download,
  Check,
  RefreshCw,
  FileCheck,
} from 'lucide-react';

export function ImportWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Mapping state: { crmFieldKey: fileColumnHeader }
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation & Duplicate state
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<string, 'SKIP' | 'UPDATE' | 'IMPORT'>>({});

  // Telecaller allocation state
  const [telecallers, setTelecallers] = useState<User[]>([]);
  const [selectedTelecallerIds, setSelectedTelecallerIds] = useState<string[]>([]);
  const [distributionMethod, setDistributionMethod] = useState<'EVEN' | 'MANUAL'>('EVEN');

  // Commit state
  const [importing, setImporting] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    loadTelecallers();
  }, []);

  async function loadTelecallers() {
    try {
      const res = await api.get<User[]>('/users', { role: 'TELECALLER', isActive: true });
      if (res.success && res.data) {
        setTelecallers(res.data);
        setSelectedTelecallerIds(res.data.map((t: User) => t.id));
      }
    } catch {
      // ignore
    }
  }

  // 1. Download Sample Spreadsheet Template
  function downloadSampleTemplate() {
    const sampleData = [
      {
        Company: 'Apex Industrial Solvents',
        'Service / Product': 'Government Tender Procurement SaaS',
        'Contact Person': 'Robert Sterling',
        Phone: '+1-555-234-5678',
        Email: 'r.sterling@apexind.com',
        Priority: 'HIGH',
        'Pipeline Stage': 'NEW',
        'Call Attempts': 0,
        'Last Call Outcome': '',
        'Last Contact Date': '',
        'Next Follow-Up Date': '2026-10-20',
        'Next Action': 'Initial discovery call',
        'Notes/Objection': 'Interested in tender auto-tracking',
      },
      {
        Company: 'BluePeak Healthcare Infrastructure',
        'Service / Product': 'Medical Supply Chain Bid Engine',
        'Contact Person': 'Elena Rostova',
        Phone: '+1-555-345-6789',
        Email: 'elena@bluepeakhealth.org',
        Priority: 'URGENT',
        'Pipeline Stage': 'NEW',
        'Call Attempts': 0,
        'Last Call Outcome': '',
        'Last Contact Date': '',
        'Next Follow-Up Date': '2026-10-22',
        'Next Action': 'Schedule tender presentation',
        'Notes/Objection': 'Needs multi-user team hierarchy',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads_Template');
    XLSX.writeFile(workbook, 'TenderProcure_Lead_Import_Template.xlsx');
  }

  // 2. Handle File Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post<any>('/imports/upload', formData);
      if (res.success && res.data) {
        setSheetNames(res.data.sheetNames);
        setSelectedSheet(res.data.selectedSheet);
        setHeaders(res.data.headers);
        setPreviewRows(res.data.previewRows);
        setColumnMapping(res.data.suggestedMapping || {});

        // Read all rows client-side for validation payload
        const reader = new FileReader();
        reader.onload = (event) => {
          const buffer = event.target?.result;
          const wb = XLSX.read(buffer, { type: 'binary' });
          const sheet = wb.Sheets[res.data.selectedSheet || wb.SheetNames[0]];
          const allData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          setRawRows(allData);
        };
        reader.readAsBinaryString(selectedFile);

        setCurrentStep(2);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse uploaded file');
    }
  }

  // 3. Validate & Detect Duplicates
  async function handleValidateMapping() {
    setValidating(true);
    setErrorMessage('');
    try {
      const res = await api.post<any>('/imports/validate', {
        rows: rawRows.length > 0 ? rawRows : previewRows,
        columnMapping,
      });

      if (res.success && res.data) {
        setValidationResult(res.data);

        // Pre-fill duplicate decisions with recommended action
        const decisions: Record<string, 'SKIP' | 'UPDATE' | 'IMPORT'> = {};
        res.data.duplicates.forEach((d: any) => {
          decisions[d.tempRowId] = 'SKIP';
        });
        setDuplicateDecisions(decisions);

        setCurrentStep(3);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  }

  // 4. Commit Import to Database
  async function handleConfirmImport() {
    if (!validationResult) return;
    setImporting(true);
    setErrorMessage('');

    try {
      // Map rows with resolutions
      const preparedRecords = validationResult.validatedRows.map((row: any) => {
        const tempId = `row_${row.rowIndex}`;
        const duplicateDecision = duplicateDecisions[tempId];
        let action: 'IMPORT' | 'UPDATE' | 'SKIP' = 'IMPORT';

        if (row.hasDuplicate) {
          if (duplicateDecision === 'SKIP') action = 'SKIP';
          else if (duplicateDecision === 'UPDATE') action = 'UPDATE';
          else action = 'IMPORT';
        }

        return {
          ...row.mapped,
          action,
          matchedExistingId: row.duplicateMatch?.id,
        };
      });

      const res = await api.post<any>('/imports/commit', {
        fileName: file?.name || 'leads_import.xlsx',
        records: preparedRecords,
        distributionMethod,
        selectedTelecallerIds,
      });

      if (res.success && res.data) {
        setImportReport(res.data);
        setCurrentStep(5); // Complete summary
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete import');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Step Progress Tracker */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-soft-sm">
        <div className="flex items-center justify-between">
          {[
            { step: 1, title: 'Upload File' },
            { step: 2, title: 'Map Columns' },
            { step: 3, title: 'Duplicate Review' },
            { step: 4, title: 'Assign Telecallers' },
            { step: 5, title: 'Import Summary' },
          ].map((item, idx, arr) => (
            <React.Fragment key={item.step}>
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    currentStep === item.step
                      ? 'bg-sky-600 text-white shadow-soft-sm ring-4 ring-sky-100'
                      : currentStep > item.step
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {currentStep > item.step ? <Check className="h-4 w-4" /> : item.step}
                </span>
                <span
                  className={`text-xs font-bold hidden sm:inline ${
                    currentStep === item.step ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {item.title}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 transition-colors ${
                    currentStep > item.step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: Upload File & Template Download */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 1: Upload Lead Spreadsheet</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Upload your client leads in Excel (.xlsx) or Comma Separated Values (.csv) format.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleTemplate}
              icon={<Download className="h-4 w-4 text-sky-600" />}
            >
              Download Sample Template
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-sky-500 hover:bg-sky-50/20 transition-all cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-3 shadow-soft-sm">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Drag and drop your spreadsheet here, or click to browse
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Supports .xlsx workbooks with multiple sheets and standard .csv files up to 10MB.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-slate-800 block">Supported Standard Template Columns:</span>
              <p className="leading-relaxed">
                Company, Service / Product, Contact Person, Phone, Email, Priority, Pipeline Stage, Call Attempts, Last Call Outcome, Last Contact Date, Next Follow-Up Date, Next Action, Notes/Objection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Column Mapping & Data Preview */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 2: Map Spreadsheet Columns to CRM Fields</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                File: <strong>{file?.name}</strong> ({rawRows.length || previewRows.length} total rows detected)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(1)}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Choose Different File
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sheet Selector if multiple sheets exist */}
            {sheetNames.length > 1 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">Workbook Sheet:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded px-2.5 py-1"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Column Mapping Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Map Fields (CRM Standard Target &larr; Uploaded File Column)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'companyName', label: 'Company Name', required: true },
                  { key: 'contactPerson', label: 'Contact Person', required: true },
                  { key: 'phone', label: 'Phone Number', required: true },
                  { key: 'serviceProduct', label: 'Service / Product', required: true },
                  { key: 'email', label: 'Email Address' },
                  { key: 'priority', label: 'Priority (LOW, MEDIUM, HIGH, URGENT)' },
                  { key: 'pipelineStage', label: 'Pipeline Stage' },
                  { key: 'notes', label: 'Notes / Objections' },
                  { key: 'nextAction', label: 'Next Action' },
                  { key: 'nextFollowUpDate', label: 'Next Follow-Up Date' },
                  { key: 'callAttempts', label: 'Previous Call Attempts' },
                  { key: 'lastCallOutcome', label: 'Last Call Outcome' },
                ].map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        {field.label} {field.required && <span className="text-rose-500">*</span>}
                      </span>
                    </div>
                    <select
                      value={columnMapping[field.key] || ''}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                      }
                      className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 max-w-[200px] truncate focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">-- Ignore / Unmapped --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview First 5 Rows */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Uploaded Records Preview (First 5 Rows)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      {headers.slice(0, 7).map((h) => (
                        <th key={h} className="p-2.5 truncate max-w-[150px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {headers.slice(0, 7).map((h) => (
                          <td key={h} className="p-2.5 text-slate-600 truncate max-w-[150px]">
                            {String(row[h] || '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={handleValidateMapping}
                loading={validating}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Validate & Check Duplicates
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Duplicate Review & Resolution Screen */}
      {currentStep === 3 && validationResult && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 3: Duplicate Review & Conflict Resolution</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Found <strong>{validationResult.validRows} valid rows</strong>,{' '}
                <strong>{validationResult.invalidRows} invalid rows</strong>, and{' '}
                <strong className="text-amber-700">{validationResult.duplicateRows} potential duplicates</strong>.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {validationResult.duplicates.length === 0 ? (
              <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="text-sm font-bold">Zero Duplicates Detected!</h4>
                <p className="text-xs">
                  All uploaded rows are unique and verified against existing leads in the database.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600">
                  Review each potential duplicate. Choose whether to skip, update existing lead information, or import as a separate record.
                </p>

                <div className="space-y-3">
                  {validationResult.duplicates.map((dup: any) => {
                    const decision = duplicateDecisions[dup.tempRowId] || 'SKIP';
                    return (
                      <div
                        key={dup.tempRowId}
                        className="p-4 bg-white rounded-xl border border-slate-200 shadow-soft-sm space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            {dup.matchingReason}
                          </span>

                          {/* Decision Selector */}
                          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                              onClick={() =>
                                setDuplicateDecisions({ ...duplicateDecisions, [dup.tempRowId]: 'SKIP' })
                              }
                              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                                decision === 'SKIP'
                                  ? 'bg-slate-800 text-white shadow-soft-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Skip Uploaded
                            </button>
                            <button
                              onClick={() =>
                                setDuplicateDecisions({ ...duplicateDecisions, [dup.tempRowId]: 'UPDATE' })
                              }
                              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                                decision === 'UPDATE'
                                  ? 'bg-sky-600 text-white shadow-soft-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Update Existing
                            </button>
                            <button
                              onClick={() =>
                                setDuplicateDecisions({ ...duplicateDecisions, [dup.tempRowId]: 'IMPORT' })
                              }
                              className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                                decision === 'IMPORT'
                                  ? 'bg-amber-600 text-white shadow-soft-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Import as Separate
                            </button>
                          </div>
                        </div>

                        {/* Side-by-side comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                          {/* Uploaded Record */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Uploaded In Spreadsheet
                            </span>
                            <p className="font-bold text-slate-900">{dup.uploadedRecord.companyName}</p>
                            <p className="text-slate-600">Contact: {dup.uploadedRecord.contactPerson}</p>
                            <p className="text-slate-600">Phone: {dup.uploadedRecord.phone}</p>
                            <p className="text-slate-600">Email: {dup.uploadedRecord.email || '—'}</p>
                          </div>

                          {/* Existing DB Record */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Existing Lead in CRM
                            </span>
                            {dup.existingRecord ? (
                              <>
                                <p className="font-bold text-slate-900">{dup.existingRecord.companyName}</p>
                                <p className="text-slate-600">Contact: {dup.existingRecord.contactPerson}</p>
                                <p className="text-slate-600">Phone: {dup.existingRecord.phone}</p>
                                <p className="text-slate-600">Stage: {dup.existingRecord.pipelineStage}</p>
                              </>
                            ) : (
                              <p className="text-slate-500 italic">Duplicate within uploaded batch file</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>
                Back to Mapping
              </Button>
              <Button
                size="sm"
                onClick={() => setCurrentStep(4)}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Proceed to Assignment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Select Telecallers & Allocation */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step 4: Distribute Leads to Telecallers</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Select active telecallers to distribute valid import records into their queues.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Distribution Methodology:</span>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setDistributionMethod('EVEN')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    distributionMethod === 'EVEN'
                      ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">Balanced Round-Robin</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Equally distribute leads across all selected telecallers.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMethod('MANUAL')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    distributionMethod === 'MANUAL'
                      ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">Single Queue / Manual</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Assign all records to primary designated queue.
                  </span>
                </button>
              </div>
            </div>

            {/* Telecaller Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Active Telecallers ({selectedTelecallerIds.length} selected)
                </span>
                <button
                  onClick={() =>
                    setSelectedTelecallerIds(
                      selectedTelecallerIds.length === telecallers.length ? [] : telecallers.map((t: User) => t.id)
                    )
                  }
                  className="text-xs text-sky-600 font-semibold hover:underline cursor-pointer"
                >
                  {selectedTelecallerIds.length === telecallers.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {telecallers.map((t: User) => {
                  const isChecked = selectedTelecallerIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-sky-500 bg-sky-50/30'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTelecallerIds([...selectedTelecallerIds, t.id]);
                            } else {
                              setSelectedTelecallerIds(selectedTelecallerIds.filter((id) => id !== t.id));
                            }
                          }}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{t.name}</p>
                          <p className="text-[11px] text-slate-500">{t.email}</p>
                        </div>
                      </div>
                      <Badge variant="blue" size="sm">
                        {t._count?.assignedTelecallerLeads || 0} active
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)}>
                Back to Duplicates
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                loading={importing}
                disabled={selectedTelecallerIds.length === 0}
                icon={<FileCheck className="h-4 w-4" />}
              >
                Execute Bulk Import & Assignment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Final Import Execution Report */}
      {currentStep === 5 && importReport && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Bulk Import Completed Successfully!
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Batch File: <strong>{importReport.fileName}</strong>
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stat Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Processed</span>
                <span className="text-lg font-black text-slate-900">{importReport.totalProcessed}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">New Leads Imported</span>
                <span className="text-lg font-black text-emerald-700">{importReport.importedCount}</span>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                <span className="text-[10px] uppercase font-bold text-sky-600 block">Existing Leads Updated</span>
                <span className="text-lg font-black text-sky-700">{importReport.updatedCount}</span>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Duplicates Skipped</span>
                <span className="text-lg font-black text-slate-700">{importReport.skippedCount}</span>
              </div>
            </div>

            {/* Distribution Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Telecaller Lead Allocation Breakdown
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {importReport.distribution.map((item: any) => (
                  <div key={item.telecallerId} className="p-3.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <Badge variant="blue" size="md">
                      +{item.count} leads assigned
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentStep(1);
                  setFile(null);
                  setImportReport(null);
                }}
              >
                Import Another File
              </Button>
              <Button
                size="sm"
                onClick={() => router.push('/admin/leads')}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                View Global Leads
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
