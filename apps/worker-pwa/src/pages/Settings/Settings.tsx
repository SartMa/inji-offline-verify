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

// Settings-specific components
import SyncSettings from '../../components/SyncSettings';
import OfflineIndicator from '../../components/OfflineIndicator';

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

export default function Settings(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props} themeComponents={xThemeComponents}>
      <CssBaseline enableColorScheme />
      <OfflineIndicator />
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
              <Box sx={{ mx: 2 }}>
                <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                  Settings
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Paper
                      elevation={2}
                      sx={{ p: 2, height: '100%', overflow: 'auto' }}
                    >
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        Sync Settings
                      </Typography>
                      <SyncSettings />
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <Paper
                      elevation={2}
                      sx={{ p: 2, height: '100%', overflow: 'auto' }}
                    >
                      <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                        General Settings
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Additional settings will be added here.
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
              
              <Copyright sx={{ my: 4 }} />
            </Box>
          </Stack>
        </Box>
      </Box>
    </AppTheme>
  );
}
