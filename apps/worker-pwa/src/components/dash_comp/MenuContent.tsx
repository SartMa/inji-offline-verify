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
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const mainListItems = [
  { text: 'Dashboard', icon: <HomeRoundedIcon />, path: '/dashboard', clickable: true, scrollTo: 'top' },
  { text: 'VC Verification', icon: <VerifiedUserIcon />, path: null, clickable: true, scrollTo: 'vc-verification' },
  { text: 'VP Verification', icon: <QrCodeScannerIcon />, path: '/vp-verification', clickable: true, scrollTo: null },
  { text: 'Sync Status', icon: <SyncIcon />, path: null, clickable: true, scrollTo: 'statistics' },
  { text: 'Statistics', icon: <AssessmentIcon />, path: null, clickable: true, scrollTo: 'sync-status' },
];

const secondaryListItems = [
  { text: 'Settings', icon: <SettingsRoundedIcon />, path: '/settings', clickable: true, scrollTo: null },
  { text: 'About', icon: <InfoRoundedIcon />, path: null, clickable: true, scrollTo: null, externalUrl: 'https://docs.inji.io/inji-verify/overview' },
];

interface MenuContentProps {
  isCollapsed?: boolean;
}

export default function MenuContent({ isCollapsed = false }: MenuContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string>('');

  // Smooth scroll to section function
  const scrollToSection = (sectionId: string) => {
    if (sectionId === 'top') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      setActiveSection('');
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
        setActiveSection(sectionId);
      }
    }
  };

  const handleItemClick = (item: any) => {
    if (item.scrollTo) {
      // Only scroll if we're on the dashboard page
      if (location.pathname === '/dashboard') {
        scrollToSection(item.scrollTo);
      } else {
        // Navigate to dashboard first, then scroll
        navigate('/dashboard');
        setTimeout(() => scrollToSection(item.scrollTo), 100);
      }
    } else if (item.externalUrl) {
      // Open external URL in new tab
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
    } else if (item.path) {
      navigate(item.path);
      setActiveSection('');
    }
  };

  // Detect active section based on scroll position
  useEffect(() => {
    if (location.pathname !== '/dashboard') {
      setActiveSection('');
      return;
    }

    const handleScroll = () => {
      const sections = ['vc-verification', 'statistics', 'sync-status'];
      const scrollPosition = window.scrollY + 100; // Offset for better detection
      
      // If we're at the very top (within first 150px), clear active section to highlight Dashboard
      if (window.scrollY < 150) {
        setActiveSection('');
        return;
      }

      let foundActiveSection = false;
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          const absoluteTop = window.scrollY + rect.top;
          
          if (scrollPosition >= absoluteTop && scrollPosition < absoluteTop + element.offsetHeight) {
            setActiveSection(sectionId);
            foundActiveSection = true;
            break;
          }
        }
      }
      
      // If no section is active and we're not at the top, clear the active section
      if (!foundActiveSection && window.scrollY >= 150) {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);
  
  return (
    <Stack sx={{ flexGrow: 1, p: isCollapsed ? 0.5 : 1, justifyContent: 'space-between' }}>
      <List dense sx={{ pt: 1 }}>
        {mainListItems.map((item, index) => {
          // Fix selection logic: if we're on dashboard and have an active section, 
          // only highlight the item that matches the active section, not the dashboard
          let selected = false;
          if (location.pathname === '/dashboard') {
            if (activeSection) {
              // If there's an active section, only highlight the item that matches it
              selected = item.scrollTo === activeSection;
            } else {
              // If no active section, highlight dashboard (top of page)
              selected = item.scrollTo === 'top';
            }
          } else {
            // For other pages, use the path matching
            selected = item.path === location.pathname;
          }
          
          return (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  selected={selected}
                  onClick={() => item.clickable && handleItemClick(item)}
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
          const selected = Boolean(item.path === location.pathname);
          
          return (
            <ListItem key={index} disablePadding sx={{ display: 'block' }}>
              <Tooltip title={isCollapsed ? item.text : ''} placement="right" arrow>
                <ListItemButton
                  selected={selected}
                  onClick={() => item.clickable && handleItemClick(item)}
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
