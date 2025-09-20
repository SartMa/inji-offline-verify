// React namespace not required (automatic JSX runtime)
import { alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
//import Grid from '@mui/material/Grid';

// MUI Dashboard template components
import AppNavbar from '../../components/dash_comp/AppNavbar';
import Header from '../../components/dash_comp/Header';
import SideMenu from '../../components/dash_comp/SideMenu';
import AppTheme from '../../theme/dash_theme/AppTheme';
import Copyright from '../../internals/components/Copyright';

// Worker-specific components
import SystemStatus from '../../components/SystemStatus';
import Statistics from '../../components/Statistics.tsx';
import TestInterface from '../../components/TestInterface';
import StorageLogs from '../../components/StorageLogs.tsx';
import VerificationActions from '../../components/VerificationActions';

import {
  chartsCustomizations,
  dataDisplayCustomizations,
  datePickersCustomizations,
  treeViewCustomizations,
} from '../../theme/dash_theme/customizations';

const xThemeComponents = {
  ...chartsCustomizations,
  ...dataDisplayCustomizations,
  ...datePickersCustomizations,
  ...treeViewCustomizations,
};

// Worker dashboard component that integrates the MUI template with worker-specific functionality
export default function Dashboard(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props} themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex' }}>
        <SideMenu />
        <AppNavbar />
        {/* Main content */}
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            backgroundColor: theme.vars
              ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
              : alpha(theme.palette.background.default, 1),
            overflow: 'auto',
          })}
        >
          <Stack
            spacing={3}
            sx={{
              alignItems: 'center',
              mx: 3,
              pb: 5,
              mt: { xs: 8, md: 0 },
            }}
          >
            <Header />
            
            {/* System Status - positioned below header */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
              <SystemStatus />
            </Box>
            
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
              {/* Main section title */}
              <Typography 
                component="h2" 
                variant="h6" 
                sx={{ 
                  mb: 3,
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                Worker VC Verification
              </Typography>
              
              {/* Verification Actions - Clean minimal design */}
              <Box 
                sx={{ 
                  mb: 4,
                  p: 3,
                  borderRadius: 2,
                  backgroundColor: 'rgba(55, 65, 81, 0.2)',
                  border: '1px solid',
                  borderColor: 'rgba(55, 65, 81, 0.3)',
                }}
              >
                <VerificationActions 
                  onScanComplete={(data) => console.log('Scan result:', data)}
                  onUploadComplete={(file) => console.log('File uploaded:', file.name)}
                />
              </Box>
              
              {/* Statistics Section - Remove outer container */}
              <Box sx={{ mb: 4 }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Overview
                </Typography>
                <Statistics />
              </Box>
              
              {/* Storage Logs Section - Remove outer container */}
              <Box sx={{ mb: 4 }}>
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Storage Logs
                </Typography>
                <StorageLogs />
              </Box>
              
              {/* Test Interface Section */}
              <Box 
                sx={{ 
                  mb: 4,
                  p: 3,
                  borderRadius: 2,
                  backgroundColor: 'rgba(55, 65, 81, 0.2)',
                  border: '1px solid',
                  borderColor: 'rgba(55, 65, 81, 0.3)',
                }}
              >
                <Typography 
                  variant="h6" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 2
                  }}
                >
                  Test Interface
                </Typography>
                <TestInterface />
              </Box>
              
              <Copyright sx={{ my: 4 }} />
            </Box>
          </Stack>
        </Box>
      </Box>
    </AppTheme>
  );
}