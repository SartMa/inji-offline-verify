import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

// no styled components needed for simple static display

export default function SelectContent() {
  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ width: 215, maxHeight: 56, pl: 1 }}>
      <Avatar alt="VC Verification" sx={{ bgcolor: 'warning.main', color: 'white', width: 28, height: 28 }}>
        <VerifiedUserIcon sx={{ fontSize: '1rem' }} />
      </Avatar>
      <Stack sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>
          VC Verification
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>
          Active
        </Typography>
      </Stack>
    </Stack>
  );
}
