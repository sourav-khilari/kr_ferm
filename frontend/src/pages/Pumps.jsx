import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Stack, IconButton, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Alert, Snackbar, MenuItem, Switch, FormControlLabel
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, LocalGasStation as PumpIcon } from '@mui/icons-material';
import api from '../api';

export default function Pumps() {
  const [pumps, setPumps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editPump, setEditPump] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Active');
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const loadPumps = async () => {
    setLoading(true);
    try {
      const res = await api.get('/pumps/all');
      if (res.data.success) {
        setPumps(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to load pumps', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPumps();
  }, []);

  const handleOpenAdd = () => {
    setEditPump(null);
    setName('');
    setStatus('Active');
    setOpen(true);
  };

  const handleOpenEdit = (pump) => {
    setEditPump(pump);
    setName(pump.name);
    setStatus(pump.status);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editPump) {
        await api.put(`/pumps/${editPump._id}`, { name, status });
        setSnack({ open: true, msg: 'Pump updated successfully', severity: 'success' });
      } else {
        await api.post('/pumps', { name, status });
        setSnack({ open: true, msg: 'Pump added successfully', severity: 'success' });
      }
      setOpen(false);
      loadPumps();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: err.response?.data?.message || 'Error saving pump', severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pump?')) return;
    try {
      await api.delete(`/pumps/${id}`);
      setSnack({ open: true, msg: 'Pump deleted successfully', severity: 'success' });
      loadPumps();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to delete pump', severity: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Diesel Pumps Master
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add Pump
        </Button>
      </Stack>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Pump Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">Loading...</TableCell>
                </TableRow>
              ) : pumps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">No pumps found.</TableCell>
                </TableRow>
              ) : (
                pumps.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 3,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-block',
                          bgcolor: row.status === 'Active' ? 'success.light' : 'grey.300',
                          color: row.status === 'Active' ? 'success.dark' : 'grey.700'
                        }}
                      >
                        {row.status}
                      </Box>
                    </TableCell>
                    <TableCell>{new Date(row.createdDate).toLocaleDateString()}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" color="primary" onClick={() => handleOpenEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(row._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editPump ? 'Edit Pump' : 'Add Pump'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            margin="dense"
            label="Pump Name"
            fullWidth
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            select
            margin="dense"
            label="Status"
            fullWidth
            variant="outlined"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ mt: 2 }}
          >
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Inactive">Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
