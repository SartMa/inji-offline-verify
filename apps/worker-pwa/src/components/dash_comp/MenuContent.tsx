import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import SyncIcon from '@mui/icons-material/Sync';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import { useNavigate, useLocation } from 'react-router-dom';

const mainListItems = [
  { text: 'Dashboard', icon: <HomeRoundedIcon />, path: '/dashboard', clickable: true },
  { text: 'VC Verification', icon: <VerifiedUserIcon />, path: null, clickable: false },
  { text: 'Sync Status', icon: <SyncIcon />, path: null, clickable: false },
  { text: 'Statistics', icon: <AssessmentIcon />, path: null, clickable: false },
];

const secondaryListItems = [
  { text: 'Settings', icon: <SettingsRoundedIcon />, path: '/settings', clickable: true },
  { text: 'Help', icon: <HelpRoundedIcon />, path: '/help', clickable: true },
  { text: 'About', icon: <InfoRoundedIcon />, path: '/about', clickable: true },
];

export default function MenuContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string | null) => {
    if (path) {
      navigate(path);
    }
  };
  
  return (
    <Stack sx={{ flexGrow: 1, p: 1, justifyContent: 'space-between' }}>
      <List dense>
        {mainListItems.map((item, index) => (
          <ListItem key={index} disablePadding sx={{ display: 'block' }}>
            <ListItemButton 
              selected={item.clickable && item.path === location.pathname}
              onClick={() => item.clickable && handleNavigation(item.path)}
              disabled={!item.clickable}
              sx={{
                cursor: item.clickable ? 'pointer' : 'default',
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
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <List dense>
        {secondaryListItems.map((item, index) => (
          <ListItem key={index} disablePadding sx={{ display: 'block' }}>
            <ListItemButton 
              selected={item.clickable && item.path === location.pathname}
              onClick={() => item.clickable && handleNavigation(item.path)}
              disabled={!item.clickable}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
