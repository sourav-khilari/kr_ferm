import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, Chip, Paper,
  TextField, InputAdornment, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../api';

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('en-IN');
}

function numFmt(val) {
  if (val === null || val === undefined || val === '') return '—';
  return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const FIELD_DEFS = [
  { key: 'date',      label: 'Date',       type: 'date' },
  { key: 'slNo',      label: 'Sl No' },
  { key: 'vehicleNo', label: 'Vehicle No.' },
  { key: 'product',   label: 'Product' },
  { key: 'qty',       label: 'Qty',        type: 'number' },
  { key: 'rate',      label: 'Rate',       type: 'number' },
  { key: 'amount',    label: 'Amount',     type: 'number' },
];

function validateRow(form) {
  const errs = [];
  const warns = [];
  const qty    = parseFloat(form.qty);
  const rate   = parseFloat(form.rate);
  const amount = parseFloat(form.amount);

  if (!form.vehicleNo) errs.push('Missing Vehicle No.');
  if (isNaN(qty))      errs.push('Invalid Qty value.');
  if (isNaN(rate))     errs.push('Invalid Rate value.');
  if (isNaN(amount))   errs.push('Invalid Amount value.');
  if (!isNaN(qty) && !isNaN(rate) && !isNaN(amount)) {
    const calc = qty * rate;
    if (Math.abs(amount - calc) > 0.05) {
      errs.push(`Amount mismatch — expected ${calc.toFixed(2)}, got ${amount.toFixed(2)}.`);
    }
  }
  return { errs, warns };
}

export default function DieselPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { report, fileName, pumpId } = location.state || {};

  // Working copy of parsed rows (supports edits + deletes before save)
  const [rows, setRows] = useState(() => (report?.parsedData || []).map((r, i) => ({ ...r, id: i })));

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  // Edit dialog state
  const [editRow, setEditRow]     = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [editErrors, setEditErrors]   = useState([]);
  const [editWarnings, setEditWarnings] = useState([]);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState(null);

  if (!report) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">No preview data found.</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/diesel-upload')}>
          Go to Diesel Upload
        </Button>
      </Box>
    );
  }

  // Computed counts from live rows
  const errorCount   = rows.filter(r => r.hasError).length;
  const warningCount = rows.filter(r => r.hasWarning && !r.hasError).length;
  const validCount   = rows.filter(r => !r.hasError && !r.hasWarning).length;
  const hasCriticalErrors = errorCount > 0;

  const filteredRows = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(row =>
        (row.slNo      || '').toLowerCase().includes(q) ||
        (row.vehicleNo || '').toLowerCase().includes(q) ||
        (row.product   || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'error')   r = r.filter(row => row.hasError);
      if (filterStatus === 'warning') r = r.filter(row => row.hasWarning && !row.hasError);
      if (filterStatus === 'valid')   r = r.filter(row => !row.hasError && !row.hasWarning);
    }
    return r;
  }, [rows, search, filterStatus]);

  const getRowStatus = (row) => {
    if (row.hasError)   return 'error';
    if (row.hasWarning) return 'warning';
    return 'valid';
  };

  // ── Edit handlers ────────────────────────────────────────────────────────────
  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      date:      row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      slNo:      row.slNo      || '',
      vehicleNo: row.vehicleNo || '',
      product:   row.product   || '',
      qty:       row.qty       ?? '',
      rate:      row.rate      ?? '',
      amount:    row.amount    ?? '',
    });
    const { errs, warns } = validateRow(row);
    setEditErrors(errs);
    setEditWarnings(warns);
  };

  const handleEditFieldChange = (field, value) => {
    const updated = { ...editForm, [field]: value };
    setEditForm(updated);
    const { errs, warns } = validateRow(updated);
    setEditErrors(errs);
    setEditWarnings(warns);
  };

  const handleSaveEdit = () => {
    const { errs, warns } = validateRow(editForm);
    const updatedRow = {
      ...editRow,
      ...editForm,
      date:      editForm.date ? new Date(editForm.date) : editRow.date,
      qty:       parseFloat(editForm.qty),
      rate:      parseFloat(editForm.rate),
      amount:    parseFloat(editForm.amount),
      rowErrors:   errs,
      rowWarnings: warns,
      hasError:    errs.length > 0,
      hasWarning:  warns.length > 0,
    };
    setRows(prev => prev.map(r => r.id === editRow.id ? updatedRow : r));
    setEditRow(null);
    setSnack({ open: true, msg: 'Row updated. Remember to save to database.', severity: 'info' });
  };

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const handleDelete = () => {
    setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setSnack({ open: true, msg: 'Row removed from preview.', severity: 'info' });
  };

  // ── Save to DB ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await api.post('/diesel/save', {
        fileName: fileName || 'DieselSheet.xlsx',
        pumpId,
        rows: rows.map(({ id, ...r }) => r)
      });
      if (res.data.success) {
        setSnack({ open: true, msg: 'Diesel data saved successfully!', severity: 'success' });
        setTimeout(() => navigate('/diesel-data'), 1500);
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save data.');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  // ── Cell renderer (highlights cells with matching errors/warnings) ────────────
  const makeCellRenderer = (fieldKey) => (params) => {
    const row = params.row;
    const allIssues   = [...(row.rowErrors || []), ...(row.rowWarnings || [])];
    const fieldIssues = allIssues.filter(msg => msg.toLowerCase().includes(fieldKey.toLowerCase()));
    const isError     = (row.rowErrors || []).some(msg => msg.toLowerCase().includes(fieldKey.toLowerCase()));

    const rawVal    = params.value;
    const displayVal = rawVal === null || rawVal === undefined ? '—' : String(rawVal);

    if (fieldIssues.length === 0) {
      return <Box sx={{ width: '100%', py: 0.5 }}>{displayVal}</Box>;
    }

    return (
      <Tooltip
        title={
          <Box>
            {fieldIssues.map((msg, i) => (
              <Typography key={i} variant="caption" display="block">{msg}</Typography>
            ))}
          </Box>
        }
        arrow
      >
        <Box sx={{
          width: '100%', py: 0.5, px: 0.5,
          bgcolor: isError ? '#ffcdd2' : '#fff9c4',
          borderRadius: 1, cursor: 'help',
          display: 'flex', alignItems: 'center', gap: '4px'
        }}>
          {isError
            ? <ErrorIcon sx={{ fontSize: 13, color: 'error.main', flexShrink: 0 }} />
            : <WarningIcon sx={{ fontSize: 13, color: 'warning.dark', flexShrink: 0 }} />
          }
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayVal}</span>
        </Box>
      </Tooltip>
    );
  };

  const columns = [
    {
      field: 'rowNum', headerName: '#', width: 55,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {p.row.hasError && <ErrorIcon sx={{ fontSize: 13, color: 'error.main' }} />}
          {p.row.hasWarning && !p.row.hasError && <WarningIcon sx={{ fontSize: 13, color: 'warning.dark' }} />}
          {!p.row.hasError && !p.row.hasWarning && <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />}
          {p.value}
        </Box>
      )
    },
    {
      field: 'slNo', headerName: 'Sl No', width: 80,
      renderCell: makeCellRenderer('sl')
    },
    {
      field: 'date', headerName: 'Date', width: 110,
      valueFormatter: (value) => formatDate(value),
      renderCell: makeCellRenderer('date')
    },
    {
      field: 'vehicleNo', headerName: 'Vehicle No.', width: 130,
      renderCell: makeCellRenderer('vehicle')
    },
    {
      field: 'product', headerName: 'Product', width: 110,
      renderCell: makeCellRenderer('product')
    },
    {
      field: 'qty', headerName: 'Qty', width: 90, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('qty')
    },
    {
      field: 'rate', headerName: 'Rate', width: 90, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('rate')
    },
    {
      field: 'amount', headerName: 'Amount', width: 110, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('amount')
    },
    {
      field: '_status', headerName: 'Status', width: 100, sortable: false,
      renderCell: (p) => {
        const s = getRowStatus(p.row);
        if (s === 'error')   return <Chip label="Error"   color="error"   size="small" />;
        if (s === 'warning') return <Chip label="Warning" color="warning" size="small" />;
        return <Chip label="Valid" color="success" size="small" />;
      }
    },
    {
      field: '_actions', headerName: 'Actions', width: 90, sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit row">
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove row">
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(p.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => navigate('/diesel-upload')} size="small">
              <BackIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Diesel Upload Preview
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 5 }}>
            {fileName} — {rows.length} rows loaded
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasCriticalErrors ? (
            <Tooltip title="Fix all critical errors before saving">
              <span>
                <Button variant="contained" color="error" disabled startIcon={<SaveIcon />}>
                  Cannot Save (Fix Errors)
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={<SaveIcon />}
              onClick={() => setConfirmOpen(true)}
              disabled={saving || rows.length === 0}
            >
              {saving ? 'Saving...' : 'Save to Database'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Summary chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Chip
          icon={<CheckIcon />}
          label={`Valid: ${validCount}`}
          color="success"
          variant={filterStatus === 'valid' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus(filterStatus === 'valid' ? 'all' : 'valid')}
          clickable
        />
        <Chip
          icon={<WarningIcon />}
          label={`Warnings: ${warningCount}`}
          color="warning"
          variant={filterStatus === 'warning' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus(filterStatus === 'warning' ? 'all' : 'warning')}
          clickable
        />
        <Chip
          icon={<ErrorIcon />}
          label={`Errors: ${errorCount}`}
          color="error"
          variant={filterStatus === 'error' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus(filterStatus === 'error' ? 'all' : 'error')}
          clickable
        />
        <Chip
          label={`Total: ${rows.length}`}
          variant={filterStatus === 'all' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus('all')}
          clickable
        />
      </Box>

      {hasCriticalErrors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>{errorCount} row(s)</strong> have critical errors (highlighted in red).
          Click the <strong>Edit</strong> button on each row to fix, then save.
        </Alert>
      )}

      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      {/* Search bar */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by Sl No, Vehicle, Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Showing {filteredRows.length} / {rows.length} rows
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          pageSizeOptions={[10, 20, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
          density="compact"
          disableRowSelectionOnClick
          getRowClassName={(params) => {
            const s = getRowStatus(params.row);
            return `preview-row-${s}`;
          }}
          sx={{
            minHeight: 450,
            '& .preview-row-error':   { bgcolor: '#fff5f5', '&:hover': { bgcolor: '#ffebee' } },
            '& .preview-row-warning': { bgcolor: '#fffde7', '&:hover': { bgcolor: '#fff9c4' } },
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default', fontWeight: 700 },
            '& .MuiDataGrid-cell': { fontSize: '0.82rem' }
          }}
        />
      </Paper>

      {/* Legend */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 16, bgcolor: '#ffcdd2', borderRadius: 0.5 }} />
          <Typography variant="caption">Critical Error (blocks save)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 16, height: 16, bgcolor: '#fff9c4', borderRadius: 0.5 }} />
          <Typography variant="caption">Warning (non-blocking)</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          💡 Use Edit icon to fix rows before saving. Use Delete icon to remove rows.
        </Typography>
      </Box>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────────── */}
      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Edit Diesel Row
            <IconButton onClick={() => setEditRow(null)} size="small"><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {editErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editErrors.map((e, i) => <div key={i}>• {e}</div>)}
            </Alert>
          )}
          {editWarnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {editWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {FIELD_DEFS.map(({ key, label, type }) => (
              <Box key={key} sx={{ flex: '1 1 180px', minWidth: 160 }}>
                <TextField
                  size="small"
                  fullWidth
                  label={label}
                  type={type || 'text'}
                  slotProps={type === 'date' ? { inputLabel: { shrink: true } } : {}}
                  value={editForm[key] ?? ''}
                  onChange={(e) => handleEditFieldChange(key, e.target.value)}
                />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRow(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editErrors.length > 0}
          >
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ────────────────────────────────────────────────── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove Row</DialogTitle>
        <DialogContent>
          <Typography>
            Remove row {deleteTarget?.rowNum} (Vehicle: <strong>{deleteTarget?.vehicleNo || '—'}</strong>) from this preview?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This only removes it from the current preview. It will not be saved to the database.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm Save Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Save to Database</DialogTitle>
        <DialogContent>
          <Typography>
            You are about to save <strong>{rows.length} diesel rows</strong> to the database.
            {warningCount > 0 && (
              <> Rows with warnings (<strong>{warningCount}</strong>) will also be saved.</>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
