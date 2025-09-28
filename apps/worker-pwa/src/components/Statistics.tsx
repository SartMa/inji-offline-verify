import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { SparkLineChart } from '@mui/x-charts';
import { useVCStorage } from '../context/VCStorageContext';

type AreaGradientProps = {
    color: string;
    id: string;
};

// Area gradient component for spark line charts
function AreaGradient({ color, id }: AreaGradientProps) {
    return (
        <defs>
            <linearGradient id={id} x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
        </defs>
    );
}

type Trend = 'up' | 'down' | 'neutral';

type StatCardProps = {
    title: string;
    value: string | number;
    trend: Trend;
    description: string;
    color?: string; // Made color optional with '?' to fix the "missing property" error
    data: number[];
};

// Individual stat card component
function StatCard({ title, value, trend, description, data }: StatCardProps) {
    const theme = useTheme();
    
    const trendColors = {
        up: theme.palette.mode === 'light' ? theme.palette.success.main : theme.palette.success.dark,
        down: theme.palette.mode === 'light' ? theme.palette.error.main : theme.palette.error.dark,
        neutral: theme.palette.mode === 'light' ? theme.palette.grey[400] : theme.palette.grey[700],
    };

    const labelColors: Record<Trend, 'success' | 'error' | 'default'> = {
        up: 'success',
        down: 'error', 
        neutral: 'default',
    };

    const chartColor = trendColors[trend];
    const chipColor = labelColors[trend];
    
    // Calculate actual trend percentage from data
    const getTrendPercentage = (data: number[]) => {
        if (data.length < 2) return '±0%';
        
        const recent = data.slice(-3);
        const first = recent[0];
        const last = recent[recent.length - 1];
        
        if (first === 0 && last === 0) return '±0%';
        if (first === 0) return '+100%';
        
        const percentage = Math.round(((last - first) / first) * 100);
        const sign = percentage > 0 ? '+' : '';
        return `${sign}${percentage}%`;
    };
    
    const trendPercentage = getTrendPercentage(data);

    return (
        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
            <CardContent>
                <Typography component="h3" variant="subtitle2" gutterBottom>
                    {title}
                </Typography>
                <Stack direction="column" sx={{ justifyContent: 'space-between', flexGrow: '1', gap: 1 }}>
                    <Stack sx={{ justifyContent: 'space-between' }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h4" component="p">
                                {value.toLocaleString()}
                            </Typography>
                            <Chip size="small" color={chipColor} label={trendPercentage} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {description}
                        </Typography>
                    </Stack>
                    {data && data.length > 0 && (
                        <Box sx={{ width: '100%', height: 50 }}>
                            <SparkLineChart
                                color={chartColor}
                                data={data}
                                area
                                showHighlight
                                showTooltip
                                xAxis={{
                                    scaleType: 'band',
                                    data: Array.from({ length: data.length }, (_, i) => `${i + 1}`),
                                }}
                                sx={{
                                    ['& .MuiAreaElement-root']: {
                                        fill: `url(#area-gradient-${title.replace(/\s/g, '')})`,
                                    },
                                }}
                            >
                                <AreaGradient color={chartColor} id={`area-gradient-${title.replace(/\s/g, '')}`} />
                            </SparkLineChart>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

const LAST_SEVEN_DAYS = 7;

const Statistics = () => {
    const storage = useVCStorage();
    const stats = storage?.stats || { totalStored: 0, pendingSyncCount: 0, syncedCount: 0, failedCount: 0 };
    const dailyStats = storage?.dailyStats || [];

    const syncedItems = stats.totalStored - stats.pendingSyncCount;
    const syncPercentage = stats.totalStored > 0
        ? Math.round((syncedItems / stats.totalStored) * 100)
        : 0;

    const paddedDailyStats = useMemo(() => {
        if (dailyStats.length === 0) {
            return Array.from({ length: LAST_SEVEN_DAYS }, () => ({
                totalStored: 0,
                syncedCount: 0,
                failedCount: 0,
            }));
        }

        const recent = dailyStats.slice(-LAST_SEVEN_DAYS);
        if (recent.length === LAST_SEVEN_DAYS) {
            return recent;
        }

        const padding = Array.from({ length: LAST_SEVEN_DAYS - recent.length }, () => ({
            totalStored: 0,
            syncedCount: 0,
            failedCount: 0,
        }));

        return [...padding, ...recent];
    }, [dailyStats]);

    const getSeriesFromDailyStats = (field: 'totalStored' | 'syncedCount' | 'failedCount' | 'pendingSyncCount') => {
        if (field === 'pendingSyncCount') {
            return paddedDailyStats.map(day => {
                const pending = day.totalStored - day.syncedCount - day.failedCount;
                return pending > 0 ? pending : 0;
            });
        }

        return paddedDailyStats.map(day => day[field]);
    };

    const getTrend = (data: number[]): Trend => {
        if (data.length < 2) return 'neutral';
        const recent = data.slice(-3);
        const first = recent[0];
        const last = recent[recent.length - 1];

        if (last > first) return 'up';
        if (last < first) return 'down';
        return 'neutral';
    };

    const statisticsData: StatCardProps[] = [
        {
            title: 'Total Stored',
            value: stats.totalStored,
            trend: (() => {
                const data = getSeriesFromDailyStats('totalStored');
                return data.length > 0 ? getTrend(data) : 'neutral';
            })(),
            description: 'Total verifications stored',
            data: getSeriesFromDailyStats('totalStored'),
        },
        {
            title: 'Success',
            value: stats.syncedCount,
            trend: (() => {
                const data = getSeriesFromDailyStats('syncedCount');
                return data.length > 0 ? getTrend(data) : 'neutral';
            })(),
            description: 'Successfully verified & synced',
            data: getSeriesFromDailyStats('syncedCount'),
        },
        {
            title: 'Failed',
            value: stats.failedCount,
            trend: (() => {
                const data = getSeriesFromDailyStats('failedCount');
                const trend = data.length > 0 ? getTrend(data) : 'neutral';
                return trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'neutral';
            })(),
            description: 'Failed verifications',
            data: getSeriesFromDailyStats('failedCount'),
        },
        {
            title: 'Pending',
            value: stats.pendingSyncCount,
            trend: (() => {
                const data = getSeriesFromDailyStats('pendingSyncCount');
                const trend = data.length > 0 ? getTrend(data) : 'neutral';
                return trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'neutral';
            })(),
            description: 'Waiting to sync',
            data: getSeriesFromDailyStats('pendingSyncCount'),
        },
    ];

    return (
        <Box sx={{ width: '100%' }}>
            <Stack spacing={1} sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                        Sync Progress
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                        {syncPercentage}%
                    </Typography>
                </Stack>
                <LinearProgress
                    variant="determinate"
                    value={syncPercentage}
                    sx={{ height: 6, borderRadius: 3 }}
                />
            </Stack>

            <Grid container spacing={2} sx={{ mb: 2 }}>
                {statisticsData.map((stat) => (
                    <Grid key={stat.title} size={{ xs: 6, sm: 3 }}>
                        <StatCard {...stat} />
                    </Grid>
                ))}
            </Grid>

            {stats.totalStored === 0 && (
                <Box
                    sx={{
                        textAlign: 'center',
                        py: 4,
                        color: 'text.secondary',
                    }}
                >
                    <Typography variant="h3" sx={{ fontSize: '3rem', mb: 1 }}>
                        📭
                    </Typography>
                    <Typography variant="h6" gutterBottom>
                        No data yet
                    </Typography>
                    <Typography variant="body2">
                        Start by testing the verification interface to see statistics
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default Statistics;
