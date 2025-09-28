import * as React from 'react';
import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import MuiDrawer, { drawerClasses } from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import MenuContent from './MenuContent';
import OptionsMenu from './OptionsMenu';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useSidebar } from './SidebarContext';

const drawerWidth = 240;
const collapsedDrawerWidth = 72;

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'isCollapsed',
})<{ isCollapsed: boolean }>(({ theme, isCollapsed }) => ({
  width: isCollapsed ? collapsedDrawerWidth : drawerWidth,
  flexShrink: 0,
  boxSizing: 'border-box',
  mt: 10,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.standard,
  }),
  [`& .${drawerClasses.paper}`]: {
    width: isCollapsed ? collapsedDrawerWidth : drawerWidth,
    boxSizing: 'border-box',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.standard,
    }),
    overflowX: 'visible', // Allow overflow for dropdown menus
    borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

export default function SideMenu() {
  const { user, loading } = useCurrentUser();
  const { isCollapsed, toggleSidebar } = useSidebar();
  
  // Get user display name - user is the full response, so we need user.user for the actual user data
  const userData = user?.user;
  const displayName = userData?.full_name || 
    (userData?.first_name && userData?.last_name ? `${userData.first_name} ${userData.last_name}` : userData?.username) || 
    'User';
  
  const displayEmail = userData?.email || 'user@email.com';
  
  return (
    <Drawer
      variant="permanent"
      isCollapsed={isCollapsed}
      sx={{
        display: { xs: 'none', md: 'block' },
        [`& .${drawerClasses.paper}`]: {
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          mt: 'calc(var(--template-frame-height, 0px) + 4px)',
          p: 1.5,
          justifyContent: isCollapsed ? 'center' : 'space-between',
          alignItems: 'center',
          minHeight: 56,
        }}
      >
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Inji Logo */}
            <Box
              component="img"
              src="/assets/inji_logo.png"
              alt="Inji Logo"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                objectFit: 'contain',
              }}
            />
            <Box sx={{ py: 0.5, px: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1, fontSize: '1.1rem' }}>
                Inji Portal
              </Typography>
              {/* <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                Organization Dashboard
              </Typography> */}
            </Box>
          </Box>
        )}
        <Tooltip title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            onClick={toggleSidebar}
            size="small"
            sx={{
              ml: isCollapsed ? 0 : 'auto',
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
                color: 'text.primary',
              },
            }}
          >
            {isCollapsed ? <MenuRoundedIcon /> : <MenuOpenRoundedIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <Box
        sx={{
          overflow: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MenuContent isCollapsed={isCollapsed} />
      </Box>
      <Stack
        direction="row"
        sx={{
          p: 2,
          pr: 1, // Reduce right padding to give OptionsMenu more space
          gap: 1,
          alignItems: 'flex-start', // Align to top to handle multi-line emails
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          minHeight: 60, // Ensure minimum height for wrapped text
          width: '100%',
          overflow: 'hidden', // Prevent horizontal overflow
        }}
      >
        <Avatar
          sizes="small"
          alt={displayName}
          src="/static/images/avatar/7.jpg"
          sx={{ 
            width: 36, 
            height: 36,
            transition: 'all 0.3s ease',
            cursor: isCollapsed ? 'pointer' : 'default',
            '&:hover': isCollapsed ? {
              transform: 'scale(1.1)',
            } : {},
          }}
        />
        {!isCollapsed && (
          <>
            <Box sx={{ 
              mr: 'auto',
              minWidth: 0, // Allow box to shrink
              flex: 1, // Take available space
              overflow: 'hidden' // Prevent overflow
            }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500, 
                  lineHeight: '16px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {loading ? 'Loading...' : displayName}
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'text.secondary',
                  display: 'block',
                  wordBreak: 'break-all', // Break long emails
                  whiteSpace: 'normal', // Allow wrapping
                  lineHeight: 1.2,
                  maxWidth: '100%'
                }}
              >
                {loading ? 'Loading...' : displayEmail}
              </Typography>
            </Box>
            <OptionsMenu />
          </>
        )}
      </Stack>
    </Drawer>
  );
}
