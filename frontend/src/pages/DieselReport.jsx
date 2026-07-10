import React, { useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Alert, CircularProgress
} from '@mui/material';
import { Download as DownloadIcon, TableChart as SheetIcon } from '@mui/icons-material';
import api from '../api';

export default function DieselReport() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataGroups, setDataGroups] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGeneratePreview = async () => {
    if (!fromDate || !toDate) {
      setErrorMessage('Please select both From and To dates.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.get('/diesel-report/preview-report', {
        params: { fromDate, toDate }
      });
      if (res.data.success) {
        setDataGroups(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Failed to fetch diesel sheet preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!fromDate || !toDate) return;
    try {
      const res = await api.get('/diesel-report/generate-excel', {
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
      link.download = `Diesel_Sheet_${formattedFrom}_to_${formattedTo}.xlsx`;
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
        Diesel Sheet Details Report
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
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadExcel}
              disabled={loading}
              sx={{ ml: 'auto' }}
            >
              Download Excel
            </Button>
          )}
        </Box>
        {errorMessage && <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>}
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && dataGroups.length > 0 && (
        <Paper sx={{ p: 4, overflowX: 'auto', bgcolor: '#ffffff', border: '1px solid #d1d5db' }}>
          <Typography
            variant="h6"
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
            DIESEL DETAILS FOR THE PERIOD FROM {formatDateLabel(fromDate)} TO {formatDateLabel(toDate)}
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
                      <th style={tableHeaderStyle}>Sl No</th>
                      <th style={tableHeaderStyle}>Product</th>
                      <th style={tableHeaderStyle}>Pump</th>
                      <th style={tableHeaderStyle}>Vehicle No</th>
                      <th style={tableHeaderStyle}>Qty</th>
                      <th style={tableHeaderStyle}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} style={{ height: '26px' }}>
                        <td style={tableCellStyle}>{new Date(row.date).toLocaleDateString('en-IN')}</td>
                        <td style={tableCellStyle}>{row.slNo}</td>
                        <td style={tableCellStyle}>{row.product}</td>
                        <td style={tableCellStyle}>{row.pump ? row.pump.name : ''}</td>
                        <td style={{ ...tableCellStyle, backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                          {row.vehicleNo}
                        </td>
                        <td style={tableCellStyle}>{row.qty.toFixed(2)}</td>
                        <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 'bold' }}>
                          {Math.round(row.amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ height: '28px', fontWeight: 'bold' }}>
                      <td style={totalCellStyle}></td>
                      <td style={totalCellStyle}></td>
                      <td style={totalCellStyle}></td>
                      <td style={totalCellStyle}></td>
                      <td style={{ ...totalCellStyle, textAlign: 'right' }}>Total:</td>
                      <td style={{ ...totalCellStyle, textAlign: 'center' }}>{group.totalQty.toFixed(2)}</td>
                      <td style={{ ...totalCellStyle, textAlign: 'right' }}>{Math.round(group.totalAmount).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
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
            No diesel records found for the selected dates.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

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
