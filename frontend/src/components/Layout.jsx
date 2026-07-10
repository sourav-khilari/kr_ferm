import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
  IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Container, Avatar, Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocalShipping as ShippingIcon,
  CloudUpload as UploadIcon,
  TableChart as DataIcon,
  History as HistoryIcon,
  Business as BusinessIcon,
  Assessment as PaymentSheetIcon,
  LocalGasStation as LocalGasStationIcon
} from '@mui/icons-material';

const drawerWidth = 260;

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Owners Master', icon: <PeopleIcon />, path: '/owners' },
    { text: 'Trucks Master', icon: <ShippingIcon />, path: '/trucks' },
    { text: 'Pumps Master', icon: <LocalGasStationIcon />, path: '/pumps' },
    { divider: true, label: 'Payment Sheet' },
    { text: 'Upload Payment Sheet', icon: <UploadIcon />, path: '/upload' },
    { text: 'Generate Payment Sheet', icon: <PaymentSheetIcon />, path: '/preview' },
    { text: 'Uploaded Data', icon: <DataIcon />, path: '/uploaded-data' },
    { text: 'Upload History', icon: <HistoryIcon />, path: '/history' },
    { divider: true, label: 'Diesel Sheet' },
    { text: 'Upload Diesel Sheet', icon: <UploadIcon />, path: '/diesel-upload' },
    { text: 'Generate Diesel Sheet', icon: <PaymentSheetIcon />, path: '/diesel-report' },
    { text: 'Diesel Data Log', icon: <DataIcon />, path: '/diesel-data' },
    { divider: true, label: 'Tax & Cheque Summaries' },
    { text: 'GST / RCM / Cheque Summary', icon: <PaymentSheetIcon />, path: '/summary-preview' }
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const match = menuItems.find(item => !item.divider && isActive(item.path));
    if (location.pathname === '/upload/preview') return 'Upload Preview';
    return match?.text || 'Truck Sheet Management';
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 2 }}>
        <BusinessIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
          Truck Payment
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 2, py: 2, flexGrow: 1 }}>
        {menuItems.map((item, idx) => {
          if (item.divider) {
            return (
              <Box key={idx}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.disabled" sx={{ px: 1, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {item.label}
                </Typography>
              </Box>
            );
          }
          const active = isActive(item.path);
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: 2,
                  bgcolor: active ? 'primary.light' : 'transparent',
                  color: active ? 'white' : 'text.primary',
                  '&:hover': {
                    bgcolor: active ? 'primary.main' : 'rgba(0, 0, 0, 0.04)',
                    color: active ? 'white' : 'primary.main',
                    '& .MuiListItemIcon-root': { color: active ? 'white' : 'primary.main' }
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <ListItemIcon sx={{ color: active ? 'white' : 'text.secondary', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  slotProps={{ primary: { style: { fontSize: 14, fontWeight: active ? 600 : 500 } } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>A</Avatar>
        <Box sx={{ overflow: 'hidden' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Administrator</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            admin@trucksystem.com
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.8)'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
            {getPageTitle()}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid rgba(226, 232, 240, 0.8)' }
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid rgba(226, 232, 240, 0.8)' }
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px'
        }}
      >
        <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
