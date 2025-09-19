import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOrganizationUsers } from '../../hooks/useOrganizationUsers';
import { useLogsStats } from '../../hooks/useVerificationLogs';
import Copyright from '../../internals/components/Copyright';
import HighlightedCard from './HighlightedCard';
import StatCard, { StatCardProps } from './StatCard';
import { OrganizationUsersTableSimple } from '../OrganizationUsersTableSimple';

const baseData: Omit<StatCardProps, 'value'>[] = [
  {
    title: 'Organization Users',
    interval: 'Total members',
    trend: 'up',
    data: [
      200, 24, 220, 260, 240, 380, 100, 240, 280, 240, 300, 340, 320, 360, 340, 380,
      360, 400, 380, 420, 400, 640, 340, 460, 440, 480, 460, 600, 880, 920,
    ],
  },
  {
    title: 'Total Verified VCs',
    interval: 'All time',
    trend: 'up',
    data: [
      1640, 1250, 970, 1130, 1050, 900, 720, 1080, 900, 450, 920, 820, 840, 600, 820,
      780, 800, 760, 380, 740, 660, 620, 840, 500, 520, 480, 400, 360, 300, 220,
    ],
  },
  // {
  //   title: 'Event count',
  //   interval: 'Last 30 days',
  //   trend: 'neutral',
  //   data: [
  //     500, 400, 510, 530, 520, 600, 530, 520, 510, 730, 520, 510, 530, 620, 510, 530,
  //     520, 410, 530, 520, 610, 530, 520, 610, 530, 420, 510, 430, 520, 510,
  //   ],
  // },
];

interface MainGridProps {
  orgId?: string;
}

export default function MainGrid({ orgId }: MainGridProps) {
  const navigate = useNavigate();
  const { organizationId, organizationName, loading, error } = useCurrentUser();
  
  // Use provided orgId or get from current user context
  const finalOrgId = orgId || organizationId;
  
  // Fetch organization users data to get the total count
  const { data: orgUsersData, loading: usersLoading } = useOrganizationUsers({
    orgId: finalOrgId || '',
    page: 1,
    pageSize: 1, // We only need the stats, not the actual users
  });

  // Fetch logs stats to get the total logs count
  const { data: logsStatsData, loading: logsLoading } = useLogsStats(finalOrgId || '');

  // Handle click on Total Verified VCs card
  const handleLogsCardClick = () => {
    navigate('/logs');
  };

  // Create the data array with dynamic user count and logs count
  const data: StatCardProps[] = baseData.map((item, index) => {
    if (index === 0) {
      // First card is the organization users count
      return {
        ...item,
        value: usersLoading ? '...' : (orgUsersData?.stats.total_members?.toString() || '0'),
      };
    } else if (index === 1) {
      // Second card is the "Total Verified VCs" count - shows all verification logs
      return {
        ...item,
        value: logsLoading ? '...' : (logsStatsData?.stats.total_logs?.toString() || '0'),
      };
    }
    // For other cards, use static values for now
    return {
      ...item,
      value: '200k',
    };
  });
  return (
    <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
      {/* cards */}
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        Overview
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
          mb: 2,
        }}
      >
        {data.map((card, index) => (
          <Box key={index}>
            {index === 1 ? (
              // Make the Total Verified VCs card clickable - navigates to logs page
              <Box
                onClick={handleLogsCardClick}
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <StatCard {...card} />
              </Box>
            ) : (
              <StatCard {...card} />
            )}
          </Box>
        ))}
        {/* <Box>
          <HighlightedCard />
        </Box> */}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
          },
          gap: 2,
          mb: 2,
        }}
      >
        {/* <Box>
          <SessionsChart />
        </Box>
        <Box>
          <PageViewsBarChart />
        </Box> */}
      </Box>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        {organizationName ? `${organizationName} Members` : 'Organization Members'}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            // lg: '3fr 1fr',
            lg: '3fr',
          },
          gap: 2,
        }}
      >
        <Box>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Loading organization information...
              </Typography>
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="error">
                Error loading organization: {error}
              </Typography>
            </Box>
          ) : finalOrgId ? (
            <OrganizationUsersTableSimple orgId={finalOrgId} />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No organization ID available. Please ensure you're logged in to an organization.
              </Typography>
            </Box>
          )}
        </Box>
        {/* <Box>
          <Stack gap={2} direction={{ xs: 'column', sm: 'row', lg: 'column' }}>
            <CustomizedTreeView />
            <ChartUserByCountry />
          </Stack>
        </Box> */}
      </Box>
      {/* <Copyright sx={{ my: 4 }} /> */}
    </Box>
  );
}
