import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import api from '../api';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await api.get('/upload/history');
        if (res.data.success) {
          setHistory(res.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Upload Logs & History
      </Typography>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Excel File Name</TableCell>
                <TableCell>Uploaded At</TableCell>
                <TableCell align="right">Total Records</TableCell>
                <TableCell align="right">Valid Records</TableCell>
                <TableCell align="right">Warning Records</TableCell>
                <TableCell align="center">Import Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">Loading history logs...</TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">No upload runs found in history.</TableCell>
                </TableRow>
              ) : (
                history.map((run) => (
                  <TableRow key={run._id}>
                    <TableCell sx={{ fontWeight: 600 }}>{run.fileName}</TableCell>
                    <TableCell>{new Date(run.uploadedAt).toLocaleString()}</TableCell>
                    <TableCell align="right">{run.totalRows}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                      {run.validRows}
                    </TableCell>
                    <TableCell align="right" sx={{ color: run.warningRows > 0 ? 'warning.main' : 'text.secondary' }}>
                      {run.warningRows}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={run.status || 'Completed'}
                        color={run.status === 'Failed' ? 'error' : 'success'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
