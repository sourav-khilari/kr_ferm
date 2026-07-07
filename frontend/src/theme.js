import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2b5876', // Deep elegant ocean blue
      light: '#4e779a',
      dark: '#1e3c54',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#4e54c8', // Premium indigo
      light: '#7678ed',
      dark: '#303395',
      contrastText: '#ffffff'
    },
    background: {
      default: '#f4f6f8',
      paper: '#ffffff'
    },
    text: {
      primary: '#1e293b', // Slate 800
      secondary: '#64748b' // Slate 500
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669'
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706'
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626'
    }
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.025em' },
    h2: { fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  shape: {
    borderRadius: 12
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(43, 88, 118, 0.15)'
          }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #2b5876 0%, #4e4376 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #1e3c54 0%, #3b3160 100%)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(226, 232, 240, 0.8)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: {
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.04)'
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#f8fafc',
          color: '#475569'
        }
      }
    }
  }
});

export default theme;
