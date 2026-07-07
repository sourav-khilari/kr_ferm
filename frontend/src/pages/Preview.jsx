import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  Download as DownloadIcon,
  CalendarToday as DateIcon,
  TableChart as SheetIcon
} from '@mui/icons-material';
import api from '../api';

export default function Preview() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataGroups, setDataGroups] = useState([]);
  const [isModified, setIsModified] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleGeneratePreview = async () => {
    if (!fromDate || !toDate) {
      setErrorMessage('Please select both From and To dates.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setIsModified(false);

    try {
      const res = await api.get('/payment/preview', {
        params: { fromDate, toDate }
      });
      if (res.data.success) {
        setDataGroups(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to fetch payment sheet preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (groupIndex, rowIndex, field, value) => {
    setIsModified(true);
    
    // Deep copy current groups state
    const newGroups = JSON.parse(JSON.stringify(dataGroups));
    const targetRow = newGroups[groupIndex].rows[rowIndex];

    if (field === 'qty' || field === 'amount') {
      const numVal = parseFloat(value) || 0;
      targetRow[field] = numVal;
      
      // Recalculate truck-level totals
      let newTotalQty = 0;
      let newTotalAmount = 0;
      newGroups[groupIndex].rows.forEach(r => {
        newTotalQty += parseFloat(r.qty) || 0;
        newTotalAmount += parseFloat(r.amount) || 0;
      });
      newGroups[groupIndex].totalQty = newTotalQty;
      newGroups[groupIndex].totalAmount = newTotalAmount;
    } else {
      targetRow[field] = value;
    }

    setDataGroups(newGroups);
  };

  const handleSaveChanges = async () => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    // Flatten all modified rows to send to the backend
    const allRows = dataGroups.flatMap(group => group.rows);

    try {
      const res = await api.put('/payment/update-rows', { rows: allRows });
      if (res.data.success) {
        setSuccessMessage('All payment modifications saved successfully.');
        setIsModified(false);
        // Refresh preview
        handleGeneratePreview();
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to save changes.');
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!fromDate || !toDate) return;
    try {
      const res = await api.get('/payment/generate-excel', {
        params: { fromDate, toDate },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      const formattedFrom = fromDate.replace(/-/g, '');
      const formattedTo = toDate.replace(/-/g, '');
      link.download = `Payment_Sheet_${formattedFrom}_to_${formattedTo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to download Excel file.');
    }
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Payment Sheet Preview
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ width: 200 }}
          />
          <TextField
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ width: 200 }}
          />
          <Button
            variant="contained"
            startIcon={<SheetIcon />}
            onClick={handleGeneratePreview}
            disabled={loading}
          >
            Generate Preview
          </Button>

          {dataGroups.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
              <Button
                variant="outlined"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleSaveChanges}
                disabled={loading || !isModified}
              >
                Save Changes
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
                disabled={loading}
              >
                Download Excel
              </Button>
            </Box>
          )}
        </Box>

        {errorMessage && <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mt: 2 }}>{successMessage}</Alert>}
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Excel Sheet HTML Render */}
      {!loading && dataGroups.length > 0 && (
        <Paper sx={{ p: 4, overflowX: 'auto', bgcolor: '#ffffff', border: '1px solid #d1d5db' }}>
          {/* Main Title */}
          <Typography
            variant="h5"
            align="center"
            sx={{
              fontFamily: '"Times New Roman", Times, serif',
              fontWeight: 'bold',
              mb: 4,
              borderBottom: '1px solid #000',
              pb: 1,
              textTransform: 'uppercase'
            }}
          >
            PAYMENT SHEET FOR THE PERIOD FROM {formatDateLabel(fromDate)} TO {formatDateLabel(toDate)}
          </Typography>

          <Box sx={{ minWidth: 800 }}>
            {dataGroups.map((group, groupIdx) => (
              <Box key={groupIdx} sx={{ mb: 4 }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: '14px'
                  }}
                >
                  <thead>
                    <tr style={{ height: '30px' }}>
                      <th style={tableHeaderStyle}>Date</th>
                      <th style={tableHeaderStyle}>Challan No</th>
                      <th style={tableHeaderStyle}>Party Name</th>
                      <th style={tableHeaderStyle}>Destination</th>
                      <th style={tableHeaderStyle}>Vehicle No</th>
                      <th style={tableHeaderStyle}>Qty</th>
                      <th style={tableHeaderStyle}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, rowIdx) => {
                      const displayDate = row.date ? new Date(row.date).toISOString().split('T')[0] : '';
                      return (
                        <tr key={rowIdx} style={{ height: '26px' }}>
                          <td style={tableCellStyle}>
                            <input
                              type="date"
                              value={displayDate}
                              onChange={(e) => handleCellChange(groupIdx, rowIdx, 'date', e.target.value)}
                              style={cellInputStyle}
                            />
                          </td>
                          <td style={tableCellStyle}>
                            <input
                              type="text"
                              value={row.challanNo}
                              onChange={(e) => handleCellChange(groupIdx, rowIdx, 'challanNo', e.target.value)}
                              style={cellInputStyle}
                            />
                          </td>
                          <td style={tableCellStyle}>
                            <input
                              type="text"
                              value={row.partyName}
                              onChange={(e) => handleCellChange(groupIdx, rowIdx, 'partyName', e.target.value)}
                              style={{ ...cellInputStyle, textAlign: 'left' }}
                            />
                          </td>
                          <td style={tableCellStyle}>
                            <input
                              type="text"
                              value={row.destination}
                              onChange={(e) => handleCellChange(groupIdx, rowIdx, 'destination', e.target.value)}
                              style={{ ...cellInputStyle, textAlign: 'left' }}
                            />
                          </td>
                          <td style={{ ...tableCellStyle, backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                            {row.truckNumber}
                          </td>
                          <td style={tableCellStyle}>
                            <input
                              type="number"
                              value={row.qty}
                              onChange={(e) => handleCellChange(groupIdx, rowIdx, 'qty', e.target.value)}
                              style={cellInputStyle}
                            />
                          </td>
                          <td style={tableCellStyle}>
                            <input
                              type="number"
                              value={row.amount}
                              onChange={(e) => handleCellChange(groupIdx, rowIdx, 'amount', e.target.value)}
                              style={{ ...cellInputStyle, textAlign: 'right', fontWeight: 'bold' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr style={{ height: '28px', fontWeight: 'bold' }}>
                      <td style={totalCellStyle}></td>
                      <td style={totalCellStyle}></td>
                      <td style={totalCellStyle}></td>
                      <td style={totalCellStyle}></td>
                      <td style={{ ...totalCellStyle, textAlign: 'right' }}>Total:</td>
                      <td style={{ ...totalCellStyle, textAlign: 'center' }}>
                        {group.totalQty.toFixed(2)}
                      </td>
                      <td style={{ ...totalCellStyle, textAlign: 'right' }}>
                        {group.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {/* Visual gap only when ownership changes (ownerChangeAfter is true) */}
                {group.ownerChangeAfter && (
                  <Box sx={{ height: 48 }} />
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {!loading && dataGroups.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No transaction records found for the selected dates.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

// Styling definitions to match Excel
const tableHeaderStyle = {
  border: '1px solid #000000',
  padding: '6px 8px',
  fontWeight: 'bold',
  backgroundColor: '#f1f5f9',
  textAlign: 'center'
};

const tableCellStyle = {
  border: '1px solid #000000',
  padding: '4px 6px',
  textAlign: 'center'
};

const totalCellStyle = {
  border: '1px solid #000000',
  padding: '6px 8px',
  backgroundColor: '#f8fafc'
};

const cellInputStyle = {
  width: '90%',
  border: 'none',
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  textAlign: 'center',
  backgroundColor: 'transparent',
  padding: '2px'
};
