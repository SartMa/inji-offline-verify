import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SyncIcon from '@mui/icons-material/Sync';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import { useNavigate, useLocation } from 'react-router-dom';

const mainListItems = [
  { text: 'Dashboard', icon: <HomeRoundedIcon />, path: '/dashboard', clickable: true },
  { text: 'VC Verification', icon: <VerifiedUserIcon />, path: null, clickable: false },
  { text: 'Sync Status', icon: <SyncIcon />, path: null, clickable: false },
  { text: 'Statistics', icon: <AssessmentIcon />, path: null, clickable: false },
];

const secondaryListItems = [
  { text: 'Settings', icon: <SettingsRoundedIcon />, path: '/settings', clickable: true },
  { text: 'About', icon: <InfoRoundedIcon />, path: '/about', clickable: true },
];

interface MenuContentProps {
  isCollapsed?: boolean;
}

export default function MenuContent({ isCollapsed = false }: MenuContentProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string | null) => {
    if (path) {
      navigate(path);
    }
  };
  
  return (
    <Stack sx={{ flexGrow: 1, p: isCollapsed ? 0.5 : 1, justifyContent: 'space-between' }}>
      <List dense sx={{ pt: 1 }}>
        {mainListItems.map((item, index) => {
          const selected = item.clickable && item.path === location.pathname;
          
          return (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  selected={selected}
                  onClick={() => item.clickable && handleNavigation(item.path)}
                  disabled={!item.clickable}
                  sx={{
                    minHeight: 48,
                    justifyContent: isCollapsed ? 'center' : 'initial',
                    px: isCollapsed ? 1.5 : 2.5,
                    borderRadius: 1,
                    mx: 1,
                    mb: 0.5,
                    transition: 'all 0.3s ease',
                    cursor: item.clickable ? 'pointer' : 'default',
                    '&:hover': {
                      backgroundColor: item.clickable ? 'action.hover' : 'transparent',
                    },
                    '&.Mui-disabled': {
                      opacity: 0.6,
                      '& .MuiListItemIcon-root': {
                        color: 'text.secondary',
                      },
                      '& .MuiListItemText-primary': {
                        color: 'text.secondary',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: isCollapsed ? 0 : 3,
                      justifyContent: 'center',
                      color: selected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      opacity: isCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      display: isCollapsed ? 'none' : 'block',
                    }}
                  />
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>
      <List dense>
        {secondaryListItems.map((item, index) => {
          const selected = item.clickable && item.path === location.pathname;
          
          return (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  selected={selected}
                  onClick={() => item.clickable && handleNavigation(item.path)}
                  disabled={!item.clickable}
                  sx={{
                    minHeight: 48,
                    justifyContent: isCollapsed ? 'center' : 'initial',
                    px: isCollapsed ? 1.5 : 2.5,
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
                      mr: isCollapsed ? 0 : 3,
                      justifyContent: 'center',
                      color: selected ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      opacity: isCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease',
                      display: isCollapsed ? 'none' : 'block',
                    }}
                  />
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>
    </Stack>
  );
}
