import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import MenuButton from './MenuButton';
import ColorModeIconDropdown from '../../theme/dash_theme/ColorModeIconDropdown';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user } = useAuth();
  
  return (
    <Stack
      direction="row"
      sx={{
        display: { xs: 'none', md: 'flex' },
        width: '100%',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        maxWidth: { sm: '100%', md: '1700px' },
        pt: 1.5,
      }}
      spacing={2}
    >
      <Breadcrumbs aria-label="breadcrumb">
        <Link 
          underline="hover" 
          color="inherit" 
          href="#"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <VerifiedUserIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Worker Dashboard
        </Link>
        <Typography color="text.primary">
          VC Verification
        </Typography>
      </Breadcrumbs>
      
      <Stack direction="row" sx={{ gap: 1 }}>
        <Typography variant="body2" sx={{ alignSelf: 'center', mr: 2 }}>
          {user?.email ? `Welcome, ${user.email}` : 'Welcome'}
        </Typography>
        <MenuButton showBadge aria-label="Open notifications">
          <NotificationsRoundedIcon />
        </MenuButton>
        <ColorModeIconDropdown />
      </Stack>
    </Stack>
  );
}
