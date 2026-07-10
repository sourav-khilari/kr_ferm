import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, LinearProgress,
  Grid, Card, CardContent, Alert, Stack, Chip, TextField, MenuItem
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import api from '../api';

export default function DieselUpload() {
  const navigate = useNavigate();
  const [pumps, setPumps] = useState([]);
  const [selectedPump, setSelectedPump] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [report, setReport] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPumps() {
      try {
        const res = await api.get('/pumps');
        if (res.data.success) {
          setPumps(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedPump(res.data.data[0]._id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadPumps();
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile); setReport(null); setErrorMessage('');
    } else {
      setErrorMessage('Only Excel files (.xlsx, .xls) are supported.');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls'))) {
      setFile(selectedFile); setReport(null); setErrorMessage('');
    } else {
      setErrorMessage('Only Excel files (.xlsx, .xls) are supported.');
    }
  };

  const handleValidate = async () => {
    if (!file || !selectedPump) return;
    setLoading(true);
    setUploadProgress(10);
    setErrorMessage('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploadProgress(40);
      const res = await api.post('/diesel/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadProgress(100);
      if (res.data.success) {
        setReport(res.data.report);
      } else {
        setErrorMessage(res.data.message || 'Validation failed.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Error occurred while uploading and validating sheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToPreview = () => {
    navigate('/diesel/preview', { state: { report, fileName: file?.name, pumpId: selectedPump } });
  };

  const hasCriticalErrors = report && report.errors && report.errors.length > 0;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Upload Diesel Spreadsheet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the petrol pump, drop the excel invoice log, preview formatting issues, then import.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={report ? 5 : 12}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <TextField
              select
              label="Select Petrol Pump Source"
              fullWidth
              value={selectedPump}
              onChange={(e) => setSelectedPump(e.target.value)}
              disabled={loading || !!report}
            >
              {pumps.map((pump) => (
                <MenuItem key={pump._id} value={pump._id}>
                  {pump.name}
                </MenuItem>
              ))}
            </TextField>
          </Paper>

          <Paper
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              p: 4,
              border: dragging ? '2px dashed #2b5876' : '2px dashed #cbd5e1',
              bgcolor: dragging ? 'rgba(43,88,118,0.05)' : 'background.paper',
              cursor: 'pointer',
              textAlign: 'center',
              borderRadius: 3,
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              id="excel-file-input"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={!selectedPump}
            />
            <label htmlFor="excel-file-input" style={{ cursor: selectedPump ? 'pointer' : 'not-allowed' }}>
              <UploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                {file ? file.name : 'Drag & drop Excel file here'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                or click to browse from files
              </Typography>
              <Chip label="Only .xlsx or .xls" size="small" />
            </label>
          </Paper>

          {errorMessage && (
            <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>
          )}

          {file && selectedPump && !loading && !report && (
            <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.5 }} onClick={handleValidate}>
              Analyze & Validate File
            </Button>
          )}

          {loading && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Validating cell contents...
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 8, borderRadius: 2 }} />
            </Box>
          )}

          {report && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Analysis Summary</Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Total Parsed Rows:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{report.totalRows}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Valid Rows:</Typography>
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>{report.validRows}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Warning Rows (non-blocking):</Typography>
                    <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>{report.warningRows}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Error Rows (blocking):</Typography>
                    <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>{report.errorRows || 0}</Typography>
                  </Box>
                </Stack>

                <Box sx={{ mt: 3 }}>
                  {hasCriticalErrors ? (
                    <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
                      {report.errorRows} row(s) have critical errors. Review them in Preview before saving.
                    </Alert>
                  ) : (
                    <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 2 }}>
                      No critical errors found. Ready to preview and save!
                    </Alert>
                  )}
                  <Button
                    fullWidth
                    variant="contained"
                    color={hasCriticalErrors ? 'warning' : 'success'}
                    endIcon={<ArrowIcon />}
                    onClick={handleGoToPreview}
                  >
                    View Full Preview & {hasCriticalErrors ? 'Review Errors' : 'Save'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        {report && (
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Quick Validation Summary
              </Typography>
              {report.unknownTrucks && report.unknownTrucks.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="error.main" sx={{ mb: 1 }}>
                    Unknown Trucks (will warn but not block):
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {report.unknownTrucks.map((t, i) => (
                      <Chip key={i} label={t} color="warning" variant="outlined" size="small" />
                    ))}
                  </Stack>
                </Box>
              )}
              {report.missingData && report.missingData.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                    Rows with Issues ({report.missingData.length}):
                  </Typography>
                  <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
                    {report.missingData.map((item, idx) => (
                      <Paper
                        key={idx}
                        variant="outlined"
                        sx={{
                          p: 1.5, mb: 1,
                          borderColor: item.errors?.length > 0 ? 'error.light' : 'warning.light',
                          bgcolor: item.errors?.length > 0 ? 'rgba(211,47,47,0.04)' : 'rgba(245,124,0,0.04)'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          Row {item.row} — Sl No: {item.slNo}, Vehicle: {item.vehicleNo}
                        </Typography>
                        {item.errors?.map((e, i) => (
                          <Typography key={i} variant="caption" color="error.main" display="block">• {e}</Typography>
                        ))}
                        {item.warnings?.map((w, i) => (
                          <Typography key={i} variant="caption" color="warning.dark" display="block">⚠ {w}</Typography>
                        ))}
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}
              {report.missingData?.length === 0 && (
                <Alert severity="success">All rows passed validation checks!</Alert>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
