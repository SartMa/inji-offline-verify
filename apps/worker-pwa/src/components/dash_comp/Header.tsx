import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import MenuButton from '@inji-offline-verify/shared-ui/src/components/MenuButton';
import ColorModeIconDropdown from '@inji-offline-verify/shared-ui/src/theme/ColorModeIconDropdown';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user, organization } = useAuth();
  
  const getDisplayName = () => {
  // Always prefer username for display
  return user?.username || 'Worker';
  };
  
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
        <Stack direction="column" sx={{ alignSelf: 'center', mr: 2, textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Welcome, {getDisplayName()}
          </Typography>
          {organization && (
            <Typography variant="caption" color="text.secondary">
              {organization.name} ({organization.role})
            </Typography>
          )}
        </Stack>
        <MenuButton showBadge aria-label="Open notifications">
          <NotificationsRoundedIcon />
        </MenuButton>
        <ColorModeIconDropdown />
      </Stack>
    </Stack>
  );
}
