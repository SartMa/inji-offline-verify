// React namespace not required (automatic JSX runtime)
import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid-pro/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';
import { alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';

// MUI Dashboard template components
import AppNavbar from '../../components/dash_comp/AppNavbar';
import Header from '../../components/dash_comp/Header';
import SideMenu from '../../components/dash_comp/SideMenu';
import AppTheme from '../../theme/dash_theme/AppTheme';
import Copyright from '../../internals/components/Copyright';

// Worker-specific components
import StatusBar from '../../components/StatusBar';
import Statistics from '../../components/Statistics.tsx';
import TestInterface from '../../components/TestInterface';
import SyncControls from '../../components/SyncControls';
import StorageLogs from '../../components/StorageLogs.tsx';

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
          <StatusBar />
          <Stack
            spacing={2}
            sx={{
              alignItems: 'center',
              mx: 3,
              pb: 5,
              mt: { xs: 8, md: 0 },
            }}
          >
            <Header />
            
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
              {/* Overview section with statistics */}
              <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                Worker VC Verification
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Paper
                    elevation={2}
                    sx={{ p: 2, height: '100%', overflow: 'auto' }}
                  >
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Statistics
                    </Typography>
                    <Statistics />
                  </Paper>
                </Grid>

                <Grid size={{xs: 12, md: 4}}>
                  <Paper
                    elevation={2}
                    sx={{ p: 2, height: '100%', overflow: 'auto' }}
                  >
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Sync Controls
                    </Typography>
                    <SyncControls />
                  </Paper>
                </Grid>
              </Grid>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{xs: 12, md: 8}}>
                  <Paper 
                    elevation={2}
                    sx={{ p: 2, height: '100%' }}
                  >
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Test Interface
                    </Typography>
                    <TestInterface />
                  </Paper>
                </Grid>
                
                <Grid size={{xs: 12, md: 4}}>
                  <Paper 
                    elevation={2}
                    sx={{ p: 2, height: '100%', overflow: 'auto', maxHeight: '600px' }}
                  >
                    <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                      Storage Logs
                    </Typography>
                    <StorageLogs />
                  </Paper>
                </Grid>
              </Grid>
              
              <Copyright sx={{ my: 4 }} />
            </Box>
          </Stack>
        </Box>
      </Box>
    </AppTheme>
  );
}