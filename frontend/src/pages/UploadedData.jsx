import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Typography, Paper, Chip, Button, TextField,
  InputAdornment, Select, MenuItem, FormControl, InputLabel,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, Snackbar
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../api';

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString('en-IN');
}
function numFmt(val) {
  if (val === null || val === undefined) return '—';
  return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const emptyForm = {
  date: '', challanNo: '', partyName: '', destination: '',
  truckNumber: '', qty: '', rate: '', gross: '', comm: '', amount: ''
};

const FIELD_DEFS = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'challanNo', label: 'Challan No.' },
  { key: 'partyName', label: "Party's Name" },
  { key: 'destination', label: 'Destination' },
  { key: 'truckNumber', label: 'Vehicle No.' },
  { key: 'qty', label: 'Qty', type: 'number' },
  { key: 'rate', label: 'Rate', type: 'number' },
  { key: 'gross', label: 'Gross', type: 'number' },
  { key: 'comm', label: 'Commission', type: 'number' },
  { key: 'amount', label: 'Amount', type: 'number' }
];

export default function UploadedData() {
  const location = useLocation();
  const { runId, runName } = location.state || {};
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [filters, setFilters] = useState({
    truckNumber: '', partyName: '', validationStatus: '', dateFrom: '', dateTo: '',
    uploadRun: runId || ''
  });
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editErrors, setEditErrors] = useState([]);
  const [editWarnings, setEditWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      };
      const res = await api.get('/upload/records', { params });
      if (res.data.success) {
        setRows(res.data.rows.map(r => ({ ...r, id: r._id })));
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, filters]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      challanNo: row.challanNo || '',
      partyName: row.partyName || '',
      destination: row.destination || '',
      truckNumber: row.truckNumber || '',
      qty: row.qty ?? '',
      rate: row.rate ?? '',
      gross: row.gross ?? '',
      comm: row.comm ?? '',
      amount: row.amount ?? ''
    });
    setEditErrors(row.rowErrors || []);
    setEditWarnings(row.rowWarnings || []);
  };

  const handleEditFieldChange = (field, value) => {
    const updated = { ...editForm, [field]: value };
    setEditForm(updated);
    const qty = parseFloat(updated.qty);
    const rate = parseFloat(updated.rate);
    const gross = parseFloat(updated.gross);
    const comm = parseFloat(updated.comm);
    const amount = parseFloat(updated.amount);
    const errs = [];
    const warns = [];
    if (!isNaN(qty) && !isNaN(rate) && !isNaN(gross)) {
      const calcGross = qty * rate;
      if (Math.abs(gross - calcGross) > 0.01) errs.push(`Gross mismatch: expected ${calcGross.toFixed(2)}`);
    }
    if (!isNaN(gross) && !isNaN(comm) && !isNaN(amount)) {
      const calcAmount = gross - comm;
      if (Math.abs(amount - calcAmount) > 0.01) errs.push(`Amount mismatch: expected ${calcAmount.toFixed(2)}`);
    }
    if (!updated.partyName) warns.push('Missing Party Name');
    if (!updated.destination) warns.push('Missing Destination');
    if (!updated.truckNumber) errs.push('Missing Truck Number');
    setEditErrors(errs);
    setEditWarnings(warns);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/upload/records/${editRow._id}`, editForm);
      if (res.data.success) {
        setSnack({ open: true, msg: 'Row updated successfully!', severity: 'success' });
        setEditRow(null);
        loadRows();
      }
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Update failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/upload/records/${deleteTarget._id}`);
      if (res.data.success) {
        setSnack({ open: true, msg: 'Row deleted.', severity: 'success' });
        setDeleteTarget(null);
        loadRows();
      }
    } catch (err) {
      setSnack({ open: true, msg: 'Delete failed.', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      field: 'validationStatus', headerName: '', width: 50, sortable: false,
      renderCell: (p) => {
        if (p.value === 'error') return <Tooltip title="Has errors"><ErrorIcon color="error" fontSize="small" /></Tooltip>;
        if (p.value === 'warning') return <Tooltip title="Has warnings"><WarningIcon color="warning" fontSize="small" /></Tooltip>;
        return <Tooltip title="Valid"><CheckIcon color="success" fontSize="small" /></Tooltip>;
      }
    },
    // DataGrid v7 valueFormatter: (value) => string  (NOT { value })
    { field: 'date', headerName: 'Date', width: 110, valueFormatter: (value) => formatDate(value) },
    { field: 'challanNo', headerName: 'Challan No.', width: 130 },
    { field: 'partyName', headerName: "Party's Name", width: 180 },
    { field: 'destination', headerName: 'Destination', width: 150 },
    { field: 'truckNumber', headerName: 'Vehicle No.', width: 130 },
    { field: 'qty', headerName: 'Qty', width: 90, type: 'number', valueFormatter: (value) => numFmt(value) },
    { field: 'rate', headerName: 'Rate', width: 100, type: 'number', valueFormatter: (value) => numFmt(value) },
    { field: 'gross', headerName: 'Gross', width: 110, type: 'number', valueFormatter: (value) => numFmt(value) },
    { field: 'comm', headerName: 'Comm', width: 100, type: 'number', valueFormatter: (value) => numFmt(value) },
    { field: 'amount', headerName: 'Amount', width: 120, type: 'number', valueFormatter: (value) => numFmt(value) },
    {
      field: '_actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Uploaded Data Management</Typography>
          <Typography variant="body2" color="text.secondary">
            {runName ? `Showing records for: ${runName}` : 'View, edit, or delete uploaded payment rows.'}
          </Typography>
        </Box>
        <IconButton onClick={loadRows} title="Refresh"><RefreshIcon /></IconButton>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            label="Search Truck No."
            value={filters.truckNumber}
            onChange={(e) => handleFilterChange('truckNumber', e.target.value)}
            sx={{ minWidth: 180 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                )
              }
            }}
          />
          <TextField
            size="small"
            label="Search Party Name"
            value={filters.partyName}
            onChange={(e) => handleFilterChange('partyName', e.target.value)}
            sx={{ minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={filters.validationStatus}
              onChange={(e) => handleFilterChange('validationStatus', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="valid">Valid</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="error">Error</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small" label="From Date" type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small" label="To Date" type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            sx={{ minWidth: 160 }}
          />
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Total: ${total}`} size="small" />
          {(filters.truckNumber || filters.partyName || filters.validationStatus || filters.dateFrom || filters.dateTo) && (
            <Chip
              label="Clear filters"
              size="small"
              variant="outlined"
              onDelete={() => setFilters({ truckNumber: '', partyName: '', validationStatus: '', dateFrom: '', dateTo: '', uploadRun: runId || '' })}
            />
          )}
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper sx={{ width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          density="compact"
          disableRowSelectionOnClick
          getRowClassName={(p) => {
            if (p.row.validationStatus === 'error') return 'row-error';
            if (p.row.validationStatus === 'warning') return 'row-warning';
            return '';
          }}
          sx={{
            minHeight: 420,
            '& .row-error': { bgcolor: '#fff5f5', '&:hover': { bgcolor: '#ffebee' } },
            '& .row-warning': { bgcolor: '#fffde7', '&:hover': { bgcolor: '#fff9c4' } },
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default', fontWeight: 700 },
            '& .MuiDataGrid-cell': { fontSize: '0.82rem' }
          }}
        />
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Edit Row
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
              <Box key={key} sx={{ flex: '1 1 200px', minWidth: 180 }}>
                <TextField
                  size="small" fullWidth label={label}
                  type={type || 'text'}
                  slotProps={type === 'date' ? { inputLabel: { shrink: true } } : {}}
                  value={editForm[key]}
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
            disabled={saving || editErrors.length > 0}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Row</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this row?
            {deleteTarget && <> Challan: <strong>{deleteTarget.challanNo || '—'}</strong>, Truck: <strong>{deleteTarget.truckNumber}</strong></>}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
