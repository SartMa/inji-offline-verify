import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BlockIcon from '@mui/icons-material/Block';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { NavLink, useLocation } from 'react-router-dom';

const mainListItems = [
  { text: 'Home', icon: <HomeRoundedIcon />, to: '/dashboard' },
  { text: 'Add Worker', icon: <PersonAddIcon />, to: '/add-worker' },
  { text: 'Add DID', icon: <FingerprintIcon />, to: '/add-did' },
  { text: 'Add Revoked VC', icon: <BlockIcon />, to: '/add-revoked-vc' },
  { text: 'Verification Logs', icon: <AssignmentIcon />, to: '/logs' },
  // you can add more items with `to` fields here later
];

const secondaryListItems = [
  { text: 'My Account', icon: <AccountCircleIcon />, to: '/my-account' },
];

interface MenuContentProps {
  isCollapsed?: boolean;
}

export default function MenuContent({ isCollapsed = false }: MenuContentProps) {
  const location = useLocation();

  return (
    <Stack sx={{ flexGrow: 1, p: isCollapsed ? 0.5 : 1, justifyContent: 'space-between' }}>
      <List dense sx={{ pt: 1 }}>
        {mainListItems.map((item, index) => {
          const selected = location.pathname === item.to;

          return (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  component={NavLink as any}
                  to={item.to}
                  selected={selected}
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
      <List dense>
        {secondaryListItems.map((item, index) => {
          const selected = location.pathname === item.to;
          
          return (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  component={NavLink as any}
                  to={item.to}
                  selected={selected}
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
