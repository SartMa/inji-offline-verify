import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer, { drawerClasses } from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import MenuButton from './MenuButton';
import MenuContent from './MenuContent';
import { logoutService } from '../../services/logoutService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useNavigate, useLocation } from 'react-router-dom';

interface SideMenuMobileProps {
  open: boolean | undefined;
  toggleDrawer: (newOpen: boolean) => () => void;
}

export default function SideMenuMobile({ open, toggleDrawer }: SideMenuMobileProps) {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get user display name - user is the full response, so we need user.user for the actual user data
  const userData = user?.user;
  const displayName = userData?.full_name || 
    (userData?.first_name && userData?.last_name ? `${userData.first_name} ${userData.last_name}` : userData?.username) || 
    'User';

  const handleMyAccount = () => {
    toggleDrawer(false)(); // Close drawer
    navigate('/my-account');
  };

  const handleLogout = async () => {
    // Close the drawer first
    toggleDrawer(false)();
    
    // Perform complete logout and redirect
    await logoutService.logout({
      redirect: true,
      redirectPath: '/signin'
    });
  };

  const isMyAccountSelected = location.pathname === '/my-account';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={toggleDrawer(false)}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        [`& .${drawerClasses.paper}`]: {
          backgroundImage: 'none',
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Stack
        sx={{
          maxWidth: '70dvw',
          height: '100%',
        }}
      >
        <Stack direction="row" sx={{ p: 2, pb: 0, gap: 1 }}>
          <Stack
            direction="row"
            sx={{ gap: 1, alignItems: 'center', flexGrow: 1, p: 1 }}
          >
            <Avatar
              sizes="small"
              alt={displayName}
              src="/static/images/avatar/7.jpg"
              sx={{ width: 24, height: 24 }}
            />
            <Typography component="p" variant="h6">
              {loading ? 'Loading...' : displayName}
            </Typography>
          </Stack>
          <MenuButton showBadge>
            <NotificationsRoundedIcon />
          </MenuButton>
        </Stack>
        <Divider />
        <Stack sx={{ flexGrow: 1 }}>
          <MenuContent />
          
          {/* Mobile-only My Account section */}
          <List dense sx={{ px: 1 }}>
            <ListItem disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                onClick={handleMyAccount}
                selected={isMyAccountSelected}
                sx={{
                  minHeight: 48,
                  px: 2.5,
                  borderRadius: 1,
                  mx: 1,
                  mb: 0.5,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: 3,
                    justifyContent: 'center',
                    color: isMyAccountSelected ? 'primary.main' : 'text.secondary',
                  }}
                >
                  <AccountCircleIcon />
                </ListItemIcon>
                <ListItemText primary="My Account" />
              </ListItemButton>
            </ListItem>
          </List>
          
          <Divider />
        </Stack>
        <Stack sx={{ p: 2 }}>
          <Button 
            variant="outlined" 
            fullWidth 
            startIcon={<LogoutRoundedIcon />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
