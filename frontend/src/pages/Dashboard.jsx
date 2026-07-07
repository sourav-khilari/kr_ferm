import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalShipping as ShippingIcon,
  CloudUpload as UploadIcon,
  Visibility as PreviewIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';
import api from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    ownersCount: 0,
    trucksCount: 0,
    recentUploads: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [ownersRes, trucksRes, uploadsRes] = await Promise.all([
          api.get('/owners?limit=1'),
          api.get('/trucks?limit=1'),
          api.get('/upload/history')
        ]);
        setStats({
          ownersCount: ownersRes.data.total || 0,
          trucksCount: trucksRes.data.total || 0,
          recentUploads: (uploadsRes.data.data || []).slice(0, 5)
        });
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const statCards = [
    {
      title: 'Total Owners',
      value: stats.ownersCount,
      icon: <PeopleIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
      color: '#e0f2fe',
      action: () => navigate('/owners'),
      btnText: 'Manage Owners'
    },
    {
      title: 'Active Trucks',
      value: stats.trucksCount,
      icon: <ShippingIcon sx={{ fontSize: 32, color: 'secondary.main' }} />,
      color: '#ede9fe',
      action: () => navigate('/trucks'),
      btnText: 'Manage Trucks'
    },
    {
      title: 'Upload Actions',
      value: 'Upload Sheet',
      icon: <UploadIcon sx={{ fontSize: 32, color: 'success.main' }} />,
      color: '#d1fae5',
      action: () => navigate('/upload'),
      btnText: 'Upload Excel'
    },
    {
      title: 'Payment Sheet',
      value: 'Generator',
      icon: <PreviewIcon sx={{ fontSize: 32, color: 'warning.main' }} />,
      color: '#fef3c7',
      action: () => navigate('/preview'),
      btnText: 'Generate Preview'
    }
  ];

  return (
    <Box>
      <Box sx={{ mb: 4, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)', color: 'white' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome back, Admin!
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Manage your truck master directories, upload transaction spreadsheets, and compile Payment Sheets.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.title}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: c.color, width: 56, height: 56 }}>
                    {c.icon}
                  </Avatar>
                  {typeof c.value === 'number' ? (
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>
                      {c.value}
                    </Typography>
                  ) : (
                    <TrendingIcon sx={{ color: 'text.secondary' }} />
                  )}
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ fontSize: 16, fontWeight: 600 }}>
                  {c.title}
                </Typography>
              </CardContent>
              <Divider />
              <Box sx={{ p: 1.5, bg: '#fafafa' }}>
                <Button fullWidth variant="text" size="small" onClick={c.action}>
                  {c.btnText}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Recent Upload Activities
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {loading ? (
              <Typography>Loading...</Typography>
            ) : stats.recentUploads.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No upload runs found. Upload a sheet to get started.</Typography>
                <Button variant="contained" color="primary" sx={{ mt: 2 }} onClick={() => navigate('/upload')}>
                  Upload First Sheet
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>File Name</TableCell>
                      <TableCell>Uploaded Date</TableCell>
                      <TableCell align="right">Total Rows</TableCell>
                      <TableCell align="right">Valid Rows</TableCell>
                      <TableCell align="right">Warning Rows</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.recentUploads.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell sx={{ fontWeight: 600 }}>{row.fileName}</TableCell>
                        <TableCell>{new Date(row.uploadedAt).toLocaleString()}</TableCell>
                        <TableCell align="right">{row.totalRows}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{row.validRows}</TableCell>
                        <TableCell align="right" sx={{ color: row.warningRows > 0 ? 'warning.main' : 'text.secondary' }}>
                          {row.warningRows}
                        </TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 5,
                              display: 'inline-block',
                              fontSize: 12,
                              fontWeight: 600,
                              bgcolor: 'success.light',
                              color: 'success.dark'
                            }}
                          >
                            {row.status}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
