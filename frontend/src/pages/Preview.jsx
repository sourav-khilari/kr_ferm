import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Save as SaveIcon,
  Download as DownloadIcon,
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
        newTotalAmount += Math.round(parseFloat(r.amount) || 0);
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

  // Calculate Verification Summary Statistics
  const summaryStats = React.useMemo(() => {
    if (!dataGroups.length) return null;

    const ownersSet = new Set();
    const trucksSet = new Set();
    let totalChallans = 0;
    let grandQty = 0;
    let grandAmount = 0;

    const ownerSummaryMap = new Map();

    dataGroups.forEach(group => {
      const owner = group.ownerName || 'Unknown Owner';
      ownersSet.add(owner);
      trucksSet.add(group.truckNumber);
      totalChallans += group.rows.length;
      grandQty += group.totalQty;
      grandAmount += group.totalAmount;

      if (!ownerSummaryMap.has(owner)) {
        ownerSummaryMap.set(owner, {
          ownerName: owner,
          trucks: new Set(),
          qtyTotal: 0,
          amountTotal: 0
        });
      }
      const os = ownerSummaryMap.get(owner);
      os.trucks.add(group.truckNumber);
      os.qtyTotal += group.totalQty;
      os.amountTotal += group.totalAmount;
    });

    return {
      ownersCount: ownersSet.size,
      trucksCount: trucksSet.size,
      totalChallans,
      grandQty,
      grandAmount,
      ownerSummaries: Array.from(ownerSummaryMap.values()).map(os => ({
        ...os,
        truckCount: os.trucks.size
      }))
    };
  }, [dataGroups]);

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

      {/* Verification Summary Panel */}
      {!loading && summaryStats && (
        <Paper sx={{ p: 3, mb: 4, border: '1px dashed #2b5876', bgcolor: '#fbfcfd' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'primary.main', borderBottom: '1px solid #e2e8f0', pb: 1 }}>
            PAYMENT SUMMARY
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Payment Period</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateLabel(fromDate)} to {formatDateLabel(toDate)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Total Owners</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{summaryStats.ownersCount}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Total Trucks</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{summaryStats.trucksCount}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Total Challans</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{summaryStats.totalChallans}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Overall Quantity</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{summaryStats.grandQty.toFixed(2)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Overall Amount</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{summaryStats.grandAmount.toLocaleString('en-IN')}</Typography>
            </Box>
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, mt: 2 }}>
            Owner Summary
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Owner Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Truck Count</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Qty Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryStats.ownerSummaries.map((os) => (
                  <TableRow key={os.ownerName} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{os.ownerName}</TableCell>
                    <TableCell align="right">{os.truckCount}</TableCell>
                    <TableCell align="right">{os.qtyTotal.toFixed(2)}</TableCell>
                    <TableCell align="right">{os.amountTotal.toLocaleString('en-IN')}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: '#f8fafc', fontWeight: 'bold' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Grand Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{summaryStats.trucksCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{summaryStats.grandQty.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>{summaryStats.grandAmount.toLocaleString('en-IN')}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
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
                        {group.totalAmount}
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
