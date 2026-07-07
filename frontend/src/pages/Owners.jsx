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
  FormControlLabel,
  Checkbox,
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

export default function Owners() {
  const [owners, setOwners] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [currentOwnerId, setCurrentOwnerId] = useState(null);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formGstApplicable, setFormGstApplicable] = useState(false);
  const [formGstNumber, setFormGstNumber] = useState('');
  const [formTdsPercentage, setFormTdsPercentage] = useState(0);
  const [formStatus, setFormStatus] = useState('Active');
  
  const [errorMsg, setErrorMsg] = useState('');

  const loadOwners = async () => {
    setLoading(true);
    try {
      const res = await api.get('/owners', {
        params: {
          search,
          page: page + 1,
          limit: rowsPerPage
        }
      });
      if (res.data.success) {
        setOwners(res.data.items);
        setTotal(res.data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwners();
  }, [page, rowsPerPage, search]);

  const handleOpenAdd = () => {
    setDialogMode('add');
    setCurrentOwnerId(null);
    setFormName('');
    setFormGstApplicable(false);
    setFormGstNumber('');
    setFormTdsPercentage(0);
    setFormStatus('Active');
    setErrorMsg('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (owner) => {
    setDialogMode('edit');
    setCurrentOwnerId(owner._id);
    setFormName(owner.name);
    setFormGstApplicable(owner.gstApplicable);
    setFormGstNumber(owner.gstNumber || '');
    setFormTdsPercentage(owner.tdsPercentage || 0);
    setFormStatus(owner.status || 'Active');
    setErrorMsg('');
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setErrorMsg('Owner Name is required');
      return;
    }
    if (formGstApplicable && !formGstNumber.trim()) {
      setErrorMsg('GST Number is required if GST is applicable');
      return;
    }

    const payload = {
      name: formName.trim(),
      gstApplicable: formGstApplicable,
      gstNumber: formGstApplicable ? formGstNumber.trim() : '',
      tdsPercentage: parseFloat(formTdsPercentage) || 0,
      status: formStatus
    };

    try {
      if (dialogMode === 'add') {
        await api.post('/owners', payload);
      } else {
        await api.put(`/owners/${currentOwnerId}`, payload);
      }
      setOpenDialog(false);
      loadOwners();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error occurred while saving owner data.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this Owner?')) {
      try {
        const res = await api.delete(`/owners/${id}`);
        if (res.data.success) {
          loadOwners();
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to delete owner.');
      }
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Owner Directory
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add Owner
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Search by Owner Name..."
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
                <TableCell>Owner Name</TableCell>
                <TableCell>GST Applicable</TableCell>
                <TableCell>GST Number</TableCell>
                <TableCell align="right">TDS %</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">Loading...</TableCell>
                </TableRow>
              ) : owners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">No owners found. Add some to get started.</TableCell>
                </TableRow>
              ) : (
                owners.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell>{row.gstApplicable ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{row.gstNumber || '-'}</TableCell>
                    <TableCell align="right">{row.tdsPercentage}%</TableCell>
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
          {dialogMode === 'add' ? 'Add New Owner' : 'Edit Owner Details'}
        </DialogTitle>
        <DialogContent dividers>
          {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
          <Stack spacing={3}>
            <TextField
              label="Owner Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              fullWidth
              required
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formGstApplicable}
                  onChange={(e) => setFormGstApplicable(e.target.checked)}
                />
              }
              label="GST Applicable"
            />
            {formGstApplicable && (
              <TextField
                label="GST Number"
                value={formGstNumber}
                onChange={(e) => setFormGstNumber(e.target.value)}
                fullWidth
                required
              />
            )}
            <TextField
              label="TDS Percentage"
              type="number"
              value={formTdsPercentage}
              onChange={(e) => setFormTdsPercentage(e.target.value)}
              fullWidth
              inputProps={{ min: 0, max: 100, step: 0.01 }}
            />
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
