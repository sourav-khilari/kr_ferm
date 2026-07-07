import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Alert, Stack, Chip, Paper,
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
  FilterList as FilterIcon
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

export default function UploadPreview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { report, fileName } = location.state || {};

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  if (!report) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">No preview data found.</Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/upload')}>
          Go to Upload
        </Button>
      </Box>
    );
  }

  const parsedData = report.parsedData || [];
  const hasCriticalErrors = parsedData.some(r => r.hasError);

  // Filter rows
  const filteredRows = useMemo(() => {
    let rows = parsedData.map((r, idx) => ({ ...r, id: idx }));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        (r.challanNo || '').toLowerCase().includes(q) ||
        (r.partyName || '').toLowerCase().includes(q) ||
        (r.truckNumber || '').toLowerCase().includes(q) ||
        (r.destination || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'error') rows = rows.filter(r => r.hasError);
      if (filterStatus === 'warning') rows = rows.filter(r => r.hasWarning && !r.hasError);
      if (filterStatus === 'valid') rows = rows.filter(r => !r.hasError && !r.hasWarning);
    }
    return rows;
  }, [parsedData, search, filterStatus]);

  const getRowStatus = (row) => {
    if (row.hasError) return 'error';
    if (row.hasWarning) return 'warning';
    return 'valid';
  };

  // Cell renderer — highlights cells that have a matching warning/error keyword
  const makeCellRenderer = (fieldKey) => (params) => {
    const row = params.row;
    const allIssues = [...(row.rowErrors || []), ...(row.rowWarnings || [])];
    const fieldIssues = allIssues.filter(msg => msg.toLowerCase().includes(fieldKey.toLowerCase()));
    const isError = (row.rowErrors || []).some(msg => msg.toLowerCase().includes(fieldKey.toLowerCase()));

    const rawVal = params.value;
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
      field: 'rowNum', headerName: '#', width: 60,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {p.row.hasError && <ErrorIcon sx={{ fontSize: 13, color: 'error.main' }} />}
          {p.row.hasWarning && !p.row.hasError && <WarningIcon sx={{ fontSize: 13, color: 'warning.dark' }} />}
          {!p.row.hasError && !p.row.hasWarning && <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />}
          {p.value}
        </Box>
      )
    },
    {
      field: 'date', headerName: 'Date', width: 110,
      // DataGrid v7 valueFormatter signature: (value) => string
      valueFormatter: (value) => formatDate(value),
      renderCell: makeCellRenderer('date')
    },
    {
      field: 'challanNo', headerName: 'Challan No.', width: 130,
      renderCell: makeCellRenderer('Challan')
    },
    {
      field: 'partyName', headerName: "Party's Name", width: 180,
      renderCell: makeCellRenderer('Party')
    },
    {
      field: 'destination', headerName: 'Destination', width: 150,
      renderCell: makeCellRenderer('Destination')
    },
    {
      field: 'truckNumber', headerName: 'Vehicle No.', width: 130,
      renderCell: makeCellRenderer('Truck')
    },
    {
      field: 'qty', headerName: 'Qty', width: 90, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('Qty')
    },
    {
      field: 'rate', headerName: 'Rate', width: 100, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('Rate')
    },
    {
      field: 'gross', headerName: 'Gross', width: 110, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('Gross')
    },
    {
      field: 'comm', headerName: 'Comm', width: 100, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('Comm')
    },
    {
      field: 'amount', headerName: 'Amount', width: 120, type: 'number',
      valueFormatter: (value) => numFmt(value),
      renderCell: makeCellRenderer('Amount')
    },
    {
      field: '_status', headerName: 'Status', width: 110, sortable: false,
      renderCell: (p) => {
        const s = getRowStatus(p.row);
        if (s === 'error') return <Chip label="Error" color="error" size="small" />;
        if (s === 'warning') return <Chip label="Warning" color="warning" size="small" />;
        return <Chip label="Valid" color="success" size="small" />;
      }
    }
  ];

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await api.post('/upload/save', {
        fileName: fileName || 'UploadedSheet.xlsx',
        rows: parsedData
      });
      if (res.data.success) {
        setSnack({ open: true, msg: 'Data saved successfully!', severity: 'success' });
        setTimeout(() => navigate('/uploaded-data'), 1500);
      }
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save data.');
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => navigate('/upload')} size="small">
              <BackIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Upload Preview
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 5 }}>
            {fileName} — {parsedData.length} rows parsed
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
              disabled={saving}
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
          label={`Valid: ${report.validRows}`}
          color="success"
          variant={filterStatus === 'valid' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus(filterStatus === 'valid' ? 'all' : 'valid')}
          clickable
        />
        <Chip
          icon={<WarningIcon />}
          label={`Warnings: ${report.warningRows}`}
          color="warning"
          variant={filterStatus === 'warning' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus(filterStatus === 'warning' ? 'all' : 'warning')}
          clickable
        />
        <Chip
          icon={<ErrorIcon />}
          label={`Errors: ${report.errorRows || 0}`}
          color="error"
          variant={filterStatus === 'error' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus(filterStatus === 'error' ? 'all' : 'error')}
          clickable
        />
        <Chip
          label={`Total: ${report.totalRows}`}
          variant={filterStatus === 'all' ? 'filled' : 'outlined'}
          onClick={() => setFilterStatus('all')}
          clickable
        />
      </Box>

      {hasCriticalErrors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>{report.errorRows} row(s)</strong> have critical errors (highlighted in red).
          These must be fixed before saving. Hover over red cells to see details.
        </Alert>
      )}

      {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

      {/* Search bar */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by challan, party, truck, destination..."
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
              Showing {filteredRows.length} / {parsedData.length} rows
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
            '& .preview-row-error': {
              bgcolor: '#fff5f5',
              '&:hover': { bgcolor: '#ffebee' }
            },
            '& .preview-row-warning': {
              bgcolor: '#fffde7',
              '&:hover': { bgcolor: '#fff9c4' }
            },
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: 'background.default',
              fontWeight: 700
            },
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
          💡 Hover over highlighted cells to see specific issue details.
        </Typography>
      </Box>

      {/* Confirm save dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Save</DialogTitle>
        <DialogContent>
          <Typography>
            You are about to save <strong>{parsedData.length} rows</strong> to the database.
            {report.warningRows > 0 && (
              <> Rows with warnings (<strong>{report.warningRows}</strong>) will also be saved.</>
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
