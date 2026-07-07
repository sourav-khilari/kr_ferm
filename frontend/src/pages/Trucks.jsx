import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Stack,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import api from '../api';

export default function Trucks() {
  const [trucks, setTrucks] = useState([]);
  const [owners, setOwners] = useState([]); // List of owners for assignment
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add');
  const [currentTruckId, setCurrentTruckId] = useState(null);

  // Form states
  const [formTruckNumber, setFormTruckNumber] = useState('');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formStatus, setFormStatus] = useState('Active');
  
  const [errorMsg, setErrorMsg] = useState('');

  const loadTrucks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trucks', {
        params: {
          search,
          page: page + 1,
          limit: rowsPerPage
        }
      });
      if (res.data.success) {
        setTrucks(res.data.items);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllOwnersList = async () => {
    try {
      const res = await api.get('/owners', { params: { limit: 1000 } });
      if (res.data.success) {
        setOwners(res.data.items);
      }
    } catch (err) {
      console.error('Failed to load owners options:', err);
    }
  };

  useEffect(() => {
    loadTrucks();
  }, [page, rowsPerPage, search]);

  useEffect(() => {
    loadAllOwnersList();
  }, []);

  const handleOpenAdd = () => {
    setDialogMode('add');
    setCurrentTruckId(null);
    setFormTruckNumber('');
    setFormOwnerId('');
    setFormStatus('Active');
    setErrorMsg('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (truck) => {
    setDialogMode('edit');
    setCurrentTruckId(truck._id);
    setFormTruckNumber(truck.truckNumber);
    setFormOwnerId(truck.owner?._id || '');
    setFormStatus(truck.status || 'Active');
    setErrorMsg('');
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formTruckNumber.trim()) {
      setErrorMsg('Truck Number is required');
      return;
    }
    if (!formOwnerId) {
      setErrorMsg('Please assign an Owner');
      return;
    }

    const payload = {
      truckNumber: formTruckNumber.toUpperCase().trim(),
      owner: formOwnerId,
      status: formStatus
    };

    try {
      if (dialogMode === 'add') {
        await api.post('/trucks', payload);
      } else {
        await api.put(`/trucks/${currentTruckId}`, payload);
      }
      setOpenDialog(false);
      loadTrucks();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error occurred while saving truck.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this Truck?')) {
      try {
        const res = await api.delete(`/trucks/${id}`);
        if (res.data.success) {
          loadTrucks();
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete truck.');
      }
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Truck Directory
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add Truck
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Search by Truck Number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} />
          }}
          sx={{ width: 300 }}
        />
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Truck Number</TableCell>
                <TableCell>Assigned Owner</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">Loading...</TableCell>
                </TableRow>
              ) : trucks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No trucks registered. Add one to start.</TableCell>
                </TableRow>
              ) : (
                trucks.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.truckNumber}</TableCell>
                    <TableCell>{row.owner ? row.owner.name : <span style={{ color: 'red' }}>Unassigned</span>}</TableCell>
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
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Add/Edit Modal */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialogMode === 'add' ? 'Register New Truck' : 'Edit Truck Registration'}
        </DialogTitle>
        <DialogContent dividers>
          {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
          <Stack spacing={3}>
            <TextField
              label="Truck Number"
              placeholder="e.g. MH04GP1234"
              value={formTruckNumber}
              onChange={(e) => setFormTruckNumber(e.target.value)}
              fullWidth
              required
              disabled={dialogMode === 'edit'}
            />
            <TextField
              select
              label="Assign Owner"
              value={formOwnerId}
              onChange={(e) => setFormOwnerId(e.target.value)}
              fullWidth
              required
            >
              <MenuItem value="">-- Select Owner --</MenuItem>
              {owners.map((owner) => (
                <MenuItem key={owner._id} value={owner._id}>
                  {owner.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              fullWidth
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
