import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Tab,
  CircularProgress, Alert
} from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../api';

function numFmt(val) {
  if (val === null || val === undefined) return '—';
  return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function intFmt(val) {
  if (val === null || val === undefined) return '—';
  return Math.round(Number(val)).toLocaleString('en-IN');
}
function signFmt(val) {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

const TH = ({ children, align = 'center' }) => (
  <TableCell
    align={align}
    sx={{ fontWeight: 700, bgcolor: '#1e3a5f', color: '#fff', whiteSpace: 'nowrap', py: 1 }}
  >
    {children}
  </TableCell>
);
const TD = ({ children, align = 'right', bold = false }) => (
  <TableCell align={align} sx={{ fontWeight: bold ? 700 : 400, py: 0.7, fontSize: '0.82rem' }}>
    {children}
  </TableCell>
);

export default function SummaryPreview() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError]       = useState('');

  const handlePreview = async () => {
    if (!fromDate || !toDate) { setError('Please select both From and To dates.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/summary/preview', { params: { fromDate, toDate } });
      if (res.data.success) setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch summary preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fromDate || !toDate) return;
    try {
      const res = await api.get('/summary/download', {
        params: { fromDate, toDate },
        responseType: 'blob'
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Joint_Payment_Summary_${fromDate.replace(/-/g, '')}_to_${toDate.replace(/-/g, '')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to download Joint Report Excel.');
    }
  };

  const gstList   = data.filter(item =>  item.gstApplicable);
  const rcmList   = data.filter(item => !item.gstApplicable);

  // Grand totals helpers
  const sumOf = (list, getter) => list.reduce((s, o) => s + (getter(o) || 0), 0);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        GST / RCM / Cheque Summary &amp; Preview
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            label="From Date" type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            size="small" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            sx={{ width: 200 }}
          />
          <TextField
            label="To Date" type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            size="small" value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            sx={{ width: 200 }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handlePreview}
            disabled={loading}
          >
            Generate Preview
          </Button>

          {data.length > 0 && (
            <Button
              variant="contained" color="success"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ ml: 'auto' }}
            >
              Download Excel (3 Sheets)
            </Button>
          )}
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && data.length > 0 && (
        <Box>
          <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ mb: 2 }}>
            <Tab label={`GST Payment (${gstList.length} owners)`} />
            <Tab label={`RCM Payment (${rcmList.length} owners)`} />
            <Tab label={`Cheque Details (${data.length} owners)`} />
          </Tabs>

          {/* ── GST Sheet Preview ─────────────────────────────────────────────── */}
          {activeTab === 0 && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TH align="center">Sl</TH>
                    <TH align="left">Truck Owner's Name</TH>
                    <TH>Truck No</TH>
                    <TH>Gross Payt</TH>
                    <TH>Taxable Value</TH>
                    <TH>Add: CGST @9%</TH>
                    <TH>Add: SGST @9%</TH>
                    <TH>Round off</TH>
                    <TH>Invoice Value</TH>
                    <TH>Diesel</TH>
                    <TH>Total Diesel</TH>
                    <TH>Less: Shortage</TH>
                    <TH>Less: TDS</TH>
                    <TH>Net Payment</TH>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gstList.map((owner, oi) => (
                    owner.trucks.map((truck, ti) => (
                      <TableRow
                        key={`${owner.ownerId}-${ti}`}
                        hover
                        sx={ti === 0 && oi % 2 === 0 ? { bgcolor: '#f8faff' } : {}}
                      >
                        {/* Owner-level cells: only show on first truck */}
                        {ti === 0 ? (
                          <>
                            <TD align="center">{oi + 1}</TD>
                            <TD align="left" bold>{owner.ownerName}</TD>
                          </>
                        ) : (
                          <>
                            <TD align="center"></TD>
                            <TD align="left"></TD>
                          </>
                        )}
                        <TD>{truck.truckNumber}</TD>
                        <TD>{intFmt(truck.grossPay)}</TD>
                        {/* Owner-level financial data: only on first truck */}
                        {ti === 0 ? (
                          <>
                            <TD>{intFmt(owner.totals.taxableValue)}</TD>
                            <TD>{intFmt(owner.totals.cgst)}</TD>
                            <TD>{intFmt(owner.totals.sgst)}</TD>
                            <TD>{signFmt(owner.totals.roundOff)}</TD>
                            <TD>{intFmt(owner.totals.invoiceValue)}</TD>
                            <TD>{intFmt(truck.diesel)}</TD>
                            <TD>{intFmt(owner.totals.totalDiesel)}</TD>
                            <TD>{intFmt(owner.totals.lessShortage)}</TD>
                            <TD>{intFmt(owner.totals.tds)}</TD>
                            <TD bold>{intFmt(owner.totals.netPayment)}</TD>
                          </>
                        ) : (
                          <>
                            <TD></TD><TD></TD><TD></TD><TD></TD><TD></TD>
                            <TD>{intFmt(truck.diesel)}</TD>
                            <TD></TD><TD></TD><TD></TD><TD></TD>
                          </>
                        )}
                      </TableRow>
                    ))
                  ))}
                  {/* Grand Total Row */}
                  {gstList.length > 0 && (
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TD align="center"></TD>
                      <TD align="left" bold>TOTAL</TD>
                      <TD></TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.taxableValue))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.taxableValue))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.cgst))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.sgst))}</TD>
                      <TD bold>{sumOf(gstList, o => o.totals.roundOff).toFixed(2)}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.invoiceValue))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.trucks.reduce((s,t) => s+t.diesel,0)))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.totalDiesel))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.lessShortage))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.tds))}</TD>
                      <TD bold>{intFmt(sumOf(gstList, o => o.totals.netPayment))}</TD>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ── RCM Sheet Preview ─────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow>
                    <TH align="center">Sl</TH>
                    <TH align="left">Truck Owner's Name</TH>
                    <TH>Truck No</TH>
                    <TH>Gross Payt</TH>
                    <TH>Total Payt</TH>
                    <TH>Less: Diesel</TH>
                    <TH>Total Diesel</TH>
                    <TH>Gross Payt</TH>
                    <TH>Less: TDS</TH>
                    <TH>Less: Shortage</TH>
                    <TH>Total Payt</TH>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rcmList.map((owner, oi) => (
                    owner.trucks.map((truck, ti) => (
                      <TableRow
                        key={`${owner.ownerId}-${ti}`}
                        hover
                        sx={ti === 0 && oi % 2 === 0 ? { bgcolor: '#f8faff' } : {}}
                      >
                        {ti === 0 ? (
                          <>
                            <TD align="center">{oi + 1}</TD>
                            <TD align="left" bold>{owner.ownerName}</TD>
                          </>
                        ) : (
                          <>
                            <TD align="center"></TD>
                            <TD align="left"></TD>
                          </>
                        )}
                        <TD>{truck.truckNumber}</TD>
                        <TD>{intFmt(truck.grossPay)}</TD>
                        {ti === 0 ? (
                          <>
                            <TD>{intFmt(owner.totals.totalPay)}</TD>
                            <TD>{intFmt(truck.diesel)}</TD>
                            <TD>{intFmt(owner.totals.totalDiesel)}</TD>
                            <TD>{intFmt(owner.totals.grossAfterDiesel)}</TD>
                            <TD>{intFmt(owner.totals.tds)}</TD>
                            <TD>{intFmt(owner.totals.shortage)}</TD>
                            <TD bold>{intFmt(owner.totals.netPayment)}</TD>
                          </>
                        ) : (
                          <>
                            <TD></TD>
                            <TD>{intFmt(truck.diesel)}</TD>
                            <TD></TD><TD></TD><TD></TD><TD></TD><TD></TD>
                          </>
                        )}
                      </TableRow>
                    ))
                  ))}
                  {rcmList.length > 0 && (
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TD align="center"></TD>
                      <TD align="left" bold>TOTAL</TD>
                      <TD></TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.totalPay))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.totalPay))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.trucks.reduce((s,t) => s+t.diesel,0)))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.totalDiesel))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.grossAfterDiesel))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.tds))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.shortage))}</TD>
                      <TD bold>{intFmt(sumOf(rcmList, o => o.totals.netPayment))}</TD>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ── Cheque Sheet Preview ──────────────────────────────────────────── */}
          {activeTab === 2 && (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TH align="center">Sl</TH>
                    <TH align="left">Truck Owner's Name</TH>
                    <TH>Net Payment</TH>
                    <TH>Cheque Date</TH>
                    <TH>Cheque No</TH>
                    <TH>Total Amount</TH>
                    <TH>Cheque Amt</TH>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((owner, oi) => (
                    <TableRow key={owner.ownerId} hover sx={oi % 2 === 0 ? { bgcolor: '#f8faff' } : {}}>
                      <TD align="center">{oi + 1}</TD>
                      <TD align="left" bold>{owner.ownerName}</TD>
                      <TD bold>{intFmt(owner.totals.netPayment)}</TD>
                      <TD>—</TD>
                      <TD>—</TD>
                      <TD>—</TD>
                      <TD>—</TD>
                    </TableRow>
                  ))}
                  {data.length > 0 && (
                    <TableRow sx={{ bgcolor: '#e3f2fd' }}>
                      <TD align="center"></TD>
                      <TD align="left" bold>TOTAL</TD>
                      <TD bold>{intFmt(sumOf(data, o => o.totals.netPayment))}</TD>
                      <TD></TD><TD></TD><TD></TD><TD></TD>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {!loading && data.length === 0 && fromDate && toDate && (
        <Alert severity="info">
          No owners with payment data found for the selected date range.
        </Alert>
      )}
    </Box>
  );
}
