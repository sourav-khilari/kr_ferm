import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Snackbar, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, TableSortLabel
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import api from '../api';

export default function UploadHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [order, setOrder] = useState('desc');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/upload/history');
      if (res.data.success) setHistory(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const sortedHistory = [...history].sort((a, b) => {
    const da = new Date(a.uploadedAt), db = new Date(b.uploadedAt);
    return order === 'desc' ? db - da : da - db;
  });

  const handleViewRecords = (run) => {
    navigate('/uploaded-data', { state: { runId: run._id, runName: run.fileName } });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete(`/upload/run/${deleteTarget._id}`);
      if (res.data.success) {
        setSnack({ open: true, msg: 'Upload run and all its rows deleted.', severity: 'success' });
        setDeleteTarget(null);
        loadHistory();
      }
    } catch (err) {
      setSnack({ open: true, msg: 'Delete failed.', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusIcon = (run) => {
    if (run.status === 'Failed') return <ErrorIcon color="error" fontSize="small" />;
    if (run.warningRows > 0) return <WarningIcon color="warning" fontSize="small" />;
    return <CheckIcon color="success" fontSize="small" />;
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Upload History</Typography>
          <Typography variant="body2" color="text.secondary">
            All past upload sessions. View records, delete a run, or re-check data.
          </Typography>
        </Box>
        <IconButton onClick={loadHistory} title="Refresh"><RefreshIcon /></IconButton>
      </Stack>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>File Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active
                    direction={order}
                    onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
                  >
                    Uploaded At
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Valid</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Warnings/Errors</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">Loading history...</TableCell>
                </TableRow>
              ) : sortedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">No upload history found.</TableCell>
                </TableRow>
              ) : (
                sortedHistory.map((run) => (
                  <TableRow key={run._id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{run.fileName}</TableCell>
                    <TableCell>{new Date(run.uploadedAt).toLocaleString('en-IN')}</TableCell>
                    <TableCell align="right">{run.totalRows}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                      {run.validRows}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: run.warningRows > 0 ? 'warning.dark' : 'text.secondary', fontWeight: 600 }}
                    >
                      {run.warningRows}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center" alignItems="center" gap={0.5}>
                        {getStatusIcon(run)}
                        <Chip
                          label={run.status || 'Completed'}
                          color={run.status === 'Failed' ? 'error' : run.warningRows > 0 ? 'warning' : 'success'}
                          size="small"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center" gap={0.5}>
                        <Tooltip title="View Records">
                          <IconButton size="small" onClick={() => handleViewRecords(run)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Run + All Rows">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(run)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete Confirm Dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Upload Run</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete the upload run and ALL associated row data.
          </Alert>
          <Typography>
            File: <strong>{deleteTarget?.fileName}</strong> ({deleteTarget?.totalRows} rows)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Everything'}
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
