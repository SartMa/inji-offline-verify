import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Stack,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  InputAdornment,
  GlobalStyles,
  useTheme,
  Snackbar,
  Alert,
} from '@mui/material';
import { alpha, styled, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import AppNavbar from '../../components/dash_comp/AppNavbar';
import SideMenu from '../../components/dash_comp/SideMenu';
import Header from '../../components/dash_comp/Header';
import AppTheme from '@inji-offline-verify/shared-ui/src/theme/AppTheme';
import { SidebarProvider } from '../../components/dash_comp/SidebarContext';
import { registerWorker } from '../../services/workerService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import CakeIcon from '@mui/icons-material/Cake';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

// Custom Step Icon Component for better visibility
const CustomStepIcon = styled('div')<{ active?: boolean; completed?: boolean }>(({ theme, active, completed }) => ({
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  fontWeight: 'bold',
  border: '2px solid',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  zIndex: 2,
  
  // Default state - using CSS variables
  ...(!active && !completed && {
    backgroundColor: 'var(--template-palette-grey-100)',
    borderColor: 'var(--template-palette-grey-300)',
    color: 'var(--template-palette-text-secondary)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    ['[data-mui-color-scheme="dark"] &']: {
      backgroundColor: 'var(--template-palette-grey-800)',
      borderColor: 'var(--template-palette-grey-600)',
      color: 'var(--template-palette-grey-400)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    },
  }),
  
  // Active state
  ...(active && {
    backgroundColor: 'var(--template-palette-primary-main)',
    borderColor: 'var(--template-palette-primary-light)',
    color: '#ffffff',
    boxShadow: '0 0 20px var(--template-palette-primary-main), 0 6px 16px var(--template-palette-primary-main)',
    transform: 'scale(1.05)',
    animation: 'activeStepPulse 2.5s infinite ease-in-out',
    '&::before': {
      content: '""',
      position: 'absolute',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      animation: 'ripple 2s infinite ease-out',
    },
  }),
  
  // Completed state
  ...(completed && {
    backgroundColor: 'var(--template-palette-success-main)',
    borderColor: 'var(--template-palette-success-light)',
    color: '#ffffff',
    boxShadow: '0 0 16px var(--template-palette-success-main), 0 4px 12px var(--template-palette-success-main)',
    transform: 'scale(1.02)',
  }),
  
  '@keyframes activeStepPulse': {
    '0%, 100%': {
      transform: 'scale(1.05)',
    },
    '50%': {
      transform: 'scale(1.08)',
    },
  },
  
  '@keyframes ripple': {
    '0%': {
      transform: 'scale(1)',
      opacity: 0.6,
    },
    '100%': {
      transform: 'scale(1.5)',
      opacity: 0,
    },
  },
  
  [theme.breakpoints.down('sm')]: {
    width: '32px',
    height: '32px',
    fontSize: '0.9rem',
    '&::before': {
      width: '38px',
      height: '38px',
    },
  },
}));

// Styled Components - Theme Aware with CSS Variables
const StyledTextField = styled(TextField)(({ theme, error }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '16px',
    backgroundColor: 'var(--template-palette-background-paper)',
    border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-grey-300)'}`,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: 'var(--template-palette-text-primary)',
    
    // Dark mode overrides
    '[data-mui-color-scheme="dark"] &': {
      backgroundColor: '#2d3748',
      border: `2px solid ${error ? '#e53e3e' : '#4a5568'}`,
      color: '#ffffff',
    },
    
    '& input': {
      color: 'var(--template-palette-text-primary)',
      fontSize: '1rem',
      padding: '16px 14px',
      
      '[data-mui-color-scheme="dark"] &': {
        color: '#ffffff',
      },
      
      // Date picker specific styling
      '&[type="date"]': {
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        letterSpacing: '0.5px',
        color: 'var(--template-palette-text-primary)',
        colorScheme: 'light',
        '[data-mui-color-scheme="dark"] &': {
          color: '#ffffff',
          colorScheme: 'dark',
        },
        '&::-webkit-calendar-picker-indicator': {
          backgroundColor: 'transparent',
          cursor: 'pointer',
          filter: 'invert(0.5) brightness(1.2)',
          borderRadius: '8px',
          padding: '4px',
          transition: 'all 0.2s ease-in-out',
          '[data-mui-color-scheme="dark"] &': {
            filter: 'invert(0.3) brightness(1.8)',
          },
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.2),
            filter: 'invert(0.2) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.2)',
            transform: 'scale(1.1)',
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: alpha('#4299e1', 0.2),
              filter: 'invert(0.4) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.2)',
            },
          },
        },
        '&::-webkit-inner-spin-button': {
          display: 'none',
        },
        '&::-webkit-clear-button': {
          display: 'none',
        },
        '&::-webkit-datetime-edit': {
          color: 'var(--template-palette-text-primary)',
          '[data-mui-color-scheme="dark"] &': {
            color: '#ffffff',
          },
        },
        '&::-webkit-datetime-edit-text': {
          color: 'var(--template-palette-text-secondary)',
          '[data-mui-color-scheme="dark"] &': {
            color: '#a0aec0',
          },
        },
        '&::-webkit-datetime-edit-month-field': {
          color: 'var(--template-palette-text-primary)',
          '[data-mui-color-scheme="dark"] &': {
            color: '#ffffff',
          },
        },
        '&::-webkit-datetime-edit-day-field': {
          color: 'var(--template-palette-text-primary)',
          '[data-mui-color-scheme="dark"] &': {
            color: '#ffffff',
          },
        },
        '&::-webkit-datetime-edit-year-field': {
          color: 'var(--template-palette-text-primary)',
          '[data-mui-color-scheme="dark"] &': {
            color: '#ffffff',
          },
        },
      },
      
      // Comprehensive autocomplete styling - removes all boxes
      '&:-webkit-autofill': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        transition: 'background-color 5000s ease-in-out 0s !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        WebkitFilter: 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        },
      },
      '&:-webkit-autofill:hover': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        WebkitFilter: 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        },
      },
      '&:-webkit-autofill:focus': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        WebkitFilter: 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        },
      },
      '&:-webkit-autofill:active': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        WebkitFilter: 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          // WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        },
      },
    },
    
    '& input::placeholder': {
      color: 'var(--template-palette-text-secondary)',
      opacity: 1,
      '[data-mui-color-scheme="dark"] &': {
        color: '#a0aec0',
      },
    },
    
    '&:hover': {
      border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)'}`,
      backgroundColor: 'var(--template-palette-grey-50)',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.15)}`,
      '[data-mui-color-scheme="dark"] &': {
        border: `2px solid ${error ? '#e53e3e' : '#4299e1'}`,
        backgroundColor: '#4a5568',
        boxShadow: `0 8px 25px ${alpha('#4299e1', 0.15)}`,
      },
    },
    
    '&.Mui-focused': {
      border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)'}`,
      backgroundColor: 'var(--template-palette-grey-50)',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.25)}`,
      '[data-mui-color-scheme="dark"] &': {
        border: `2px solid ${error ? '#e53e3e' : '#4299e1'}`,
        backgroundColor: '#4a5568',
        boxShadow: `0 8px 25px ${alpha('#4299e1', 0.25)}`,
      },
    },
    
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
  },
  
  '& .MuiInputLabel-root': {
    display: 'none',
  },
  
  '& .MuiInputAdornment-root svg': {
    color: error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)',
    fontSize: '1.25rem',
    '[data-mui-color-scheme="dark"] &': {
      color: error ? '#e53e3e' : '#4299e1',
    },
  },
  
  '& .MuiFormHelperText-root': {
    color: 'var(--template-palette-error-main)',
    fontWeight: 500,
    marginLeft: '8px',
    marginTop: '8px',
    '[data-mui-color-scheme="dark"] &': {
      color: '#e53e3e',
    },
  },
}));

const GenderButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  borderRadius: '16px',
  padding: '16px 24px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  minHeight: '56px',
  border: `2px solid ${selected ? 'var(--template-palette-primary-main)' : 'var(--template-palette-grey-300)'}`,
  backgroundColor: selected 
    ? alpha(theme.palette.primary.main, 0.2)
    : 'var(--template-palette-background-paper)',
  color: selected ? 'var(--template-palette-primary-main)' : 'var(--template-palette-text-primary)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Dark mode
  '[data-mui-color-scheme="dark"] &': {
    border: `2px solid ${selected ? '#4299e1' : '#4a5568'}`,
    backgroundColor: selected ? alpha('#4299e1', 0.2) : '#2d3748',
    color: selected ? '#4299e1' : '#ffffff',
  },
  
  '&:hover': {
    border: '2px solid var(--template-palette-primary-main)',
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
    color: 'var(--template-palette-primary-main)',
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.15)}`,
    '[data-mui-color-scheme="dark"] &': {
      border: '2px solid #4299e1',
      backgroundColor: alpha('#4299e1', 0.2),
      color: '#4299e1',
    },
  },
}));

const StepCard = styled(Box)(({ theme }) => ({
  borderRadius: '24px',
  padding: '40px',
  background: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  boxShadow: 'var(--template-shadows-1)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Explicit dark mode styling
  '[data-mui-color-scheme="dark"] &': {
    background: '#1a202c',
    backgroundColor: '#1a202c',
    borderColor: 'rgba(45, 55, 72, 0.8)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
  },
}));

const ProgressStepper = styled(Stepper)(({ theme }) => ({
  padding: '32px 0',
  
  // Connector lines between steps
  '& .MuiStepConnector-root': {
    top: '20px',
    left: 'calc(-50% + 20px)',
    right: 'calc(50% + 20px)',
    zIndex: 1,
    '& .MuiStepConnector-line': {
      height: '6px',
      border: 0,
      backgroundColor: theme.palette.mode === 'dark' ? '#4a5568' : alpha(theme.palette.primary.main, 0.2),
      borderRadius: '3px',
      transition: 'all 0.4s ease-in-out',
      position: 'relative',
      overflow: 'hidden',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        width: '0%',
        backgroundColor: theme.palette.mode === 'dark' ? '#4299e1' : theme.palette.primary.main,
        borderRadius: '3px',
        transition: 'width 0.6s ease-in-out',
      },
    },
  },
  
  // Active step connector
  '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line': {
    backgroundColor: theme.palette.mode === 'dark' ? '#48bb78' : theme.palette.success.main,
    boxShadow: `0 0 15px ${alpha(theme.palette.mode === 'dark' ? '#48bb78' : theme.palette.success.main, 0.5)}`,
    '&::before': {
      width: '100%',
      backgroundColor: theme.palette.mode === 'dark' ? '#68d391' : theme.palette.success.light,
    },
  },
  
  '& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
    backgroundColor: theme.palette.mode === 'dark' ? '#48bb78' : theme.palette.success.main,
    boxShadow: `0 0 15px ${alpha(theme.palette.mode === 'dark' ? '#48bb78' : theme.palette.success.main, 0.5)}`,
    '&::before': {
      width: '100%',
      backgroundColor: theme.palette.mode === 'dark' ? '#68d391' : theme.palette.success.light,
    },
  },
  
  // Step label container
  '& .MuiStepLabel-root': {
    '& .MuiStepLabel-iconContainer': {
      padding: '0',
      zIndex: 2,
    },
    
    // Label text styling
    '& .MuiStepLabel-label': {
      color: `${alpha(theme.palette.text.primary, 0.8)} !important`,
      fontWeight: '500 !important',
      fontSize: '0.95rem !important',
      marginTop: '10px !important',
      textAlign: 'center',
      transition: 'all 0.3s ease-in-out !important',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      '[data-mui-color-scheme="dark"] &': {
        color: '#a0aec0 !important',
      },
    },
    
    '&.Mui-active .MuiStepLabel-label': {
      color: `${theme.palette.primary.main} !important`,
      fontWeight: '700 !important',
      fontSize: '1rem !important',
      textShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.5)}`,
      letterSpacing: '0.6px',
      '[data-mui-color-scheme="dark"] &': {
        color: '#90cdf4 !important',
        textShadow: '0 0 10px rgba(144, 205, 244, 0.5)',
      },
    },
    
    '&.Mui-completed .MuiStepLabel-label': {
      color: `${theme.palette.success.main} !important`,
      fontWeight: '600 !important',
      fontSize: '0.98rem !important',
      textShadow: `0 0 8px ${alpha(theme.palette.success.main, 0.5)}`,
      letterSpacing: '0.5px',
      '[data-mui-color-scheme="dark"] &': {
        color: '#9ae6b4 !important',
        textShadow: '0 0 8px rgba(154, 230, 180, 0.5)',
      },
    },
  },
  
  // Hide default step icons
  '& .MuiStepIcon-root': {
    display: 'none',
  },
  
  // Mobile responsiveness
  [theme.breakpoints.down('sm')]: {
    padding: '18px 0',
    '& .MuiStepConnector-root': {
      top: '16px',
      left: 'calc(-50% + 16px)',
      right: 'calc(50% + 16px)',
      '& .MuiStepConnector-line': {
        height: '4px',
      },
    },
    '& .MuiStepLabel-label': {
      fontSize: '0.85rem !important',
      marginTop: '8px !important',
      letterSpacing: '0.3px !important',
      color: `${alpha(theme.palette.text.primary, 0.75)} !important`,
      '[data-mui-color-scheme="dark"] &': {
        color: '#a0aec0 !important',
      },
    },
  },
}));

// Calendar Global Styles - Theme Aware
const CalendarGlobalStyles = () => {
  const theme = useTheme();
  
  return (
    <GlobalStyles
      styles={{
        'input[type="date"]::-webkit-calendar-picker-indicator': {
          cursor: 'pointer',
          filter: theme.palette.mode === 'dark' 
            ? 'invert(0.8) brightness(1.1)' 
            : 'invert(0.3) brightness(0.9)',
          borderRadius: '6px',
          padding: '4px',
          transition: 'all 0.3s ease',
          marginLeft: 'auto',
          '&:hover': {
            filter: theme.palette.mode === 'dark'
              ? 'invert(0.4) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.4)'
              : 'invert(0.2) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.2)',
            transform: 'scale(1.1)',
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
          },
        },
        
        'input[type="date"]': {
          colorScheme: theme.palette.mode,
          position: 'relative',
          cursor: 'pointer',
          color: theme.palette.text.primary,
          '&:focus': {
            outline: 'none',
          },
          '&::-webkit-inner-spin-button': {
            display: 'none',
          },
          '&::-webkit-clear-button': {
            display: 'none',
          },
          '&::-webkit-datetime-edit': {
            color: theme.palette.text.primary,
            fontWeight: '500',
          },
          '&::-webkit-datetime-edit-fields-wrapper': {
            padding: '0',
          },
          '&::-webkit-datetime-edit-text': {
            color: theme.palette.text.secondary,
            padding: '0 2px',
          },
          '&::-webkit-datetime-edit-month-field': {
            color: theme.palette.text.primary,
          },
          '&::-webkit-datetime-edit-day-field': {
            color: theme.palette.text.primary,
          },
          '&::-webkit-datetime-edit-year-field': {
            color: theme.palette.text.primary,
          },
        },

        // Firefox date picker styling
        'input[type="date"]::-moz-focus-inner': {
          border: 0,
          padding: 0,
        },
      }}
    />
  );
};

export default function AddWorker() {
  const theme = useTheme();
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const { organizationName } = useCurrentUser();
  const [activeStep, setActiveStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    phone_number: '',
    gender: 'M',
    dob: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const steps = ['Organization', 'Personal Details', 'Account Setup'];

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleGenderSelect = (gender: string) => {
    setForm((f) => ({ ...f, gender }));
  };

  const handleToastClose = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const showToast = (message: string, severity: 'success' | 'error') => {
    setToast({
      open: true,
      message,
      severity
    });
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const validateCurrentStep = () => {
    const errors: {[key: string]: string} = {};
    let isValid = true;

    switch (activeStep) {
      case 0:
        // No validation needed; organization is fixed by admin's current org
        break;
      
      case 1:
        if (!form.full_name.trim()) {
          errors.full_name = 'Full name is required';
          isValid = false;
        }
        if (!form.email.trim()) {
          errors.email = 'Email address is required';
          isValid = false;
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(form.email)) {
            errors.email = 'Please enter a valid email address';
            isValid = false;
          }
        }
        if (!form.phone_number.trim()) {
          errors.phone_number = 'Phone number is required';
          isValid = false;
        }
        break;
      
      case 2:
        if (!form.username.trim()) {
          errors.username = 'Username is required';
          isValid = false;
        }
        if (!form.password.trim()) {
          errors.password = 'Password is required';
          isValid = false;
        } else if (form.password.length < 6) {
          errors.password = 'Password must be at least 6 characters long';
          isValid = false;
        }
        break;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentStep()) {
      return;
    }
    setSubmitting(true);
    try {
      await registerWorker(form);
      showToast('Worker created successfully! Registration completed.', 'success');
      setForm((f) => ({ ...f, username: '', password: '', email: '', full_name: '', phone_number: '', dob: '' }));
      setActiveStep(0);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 
                          err?.message || 
                          'Failed to register worker. Please check your information and try again.';
      showToast(errorMessage, 'error');
      console.error('Failed to register worker:', err?.message || err);
    } finally {
      setSubmitting(false);
    }
  };

  // Step content renderer
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={4}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <BusinessIcon sx={{ fontSize: 48, color: isDark ? '#4299e1' : 'primary.main', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                Organization
              </Typography>
              <Typography variant="body1" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                Workers are added to your current organization.
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <StyledTextField
                  fullWidth
                  name="organization"
                  value={organizationName || 'Loading...'}
                  placeholder="Organization"
                  InputProps={{
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Stack>
        );
      
      case 1:
        return (
          <Stack spacing={4}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <PersonIcon sx={{ fontSize: 48, color: isDark ? '#4299e1' : 'primary.main', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                Personal Details
              </Typography>
              <Typography variant="body1" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                Tell us about the worker's personal information
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StyledTextField
                  required
                  fullWidth
                  name="full_name"
                  value={form.full_name}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter full name *"
                  error={!!fieldErrors.full_name}
                  helperText={fieldErrors.full_name}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StyledTextField
                  required
                  fullWidth
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter email address *"
                  error={!!fieldErrors.email}
                  helperText={fieldErrors.email}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StyledTextField
                  required
                  fullWidth
                  name="phone_number"
                  value={form.phone_number}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter phone number *"
                  error={!!fieldErrors.phone_number}
                  helperText={fieldErrors.phone_number}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StyledTextField
                  fullWidth
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Select date of birth"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CakeIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: isDark ? '#ffffff' : 'text.primary' }}>
                  Gender
                </Typography>
                <Stack direction="row" spacing={2}>
                  <GenderButton
                    selected={form.gender === 'M'}
                    onClick={() => handleGenderSelect('M')}
                    fullWidth
                  >
                    Male
                  </GenderButton>
                  <GenderButton
                    selected={form.gender === 'F'}
                    onClick={() => handleGenderSelect('F')}
                    fullWidth
                  >
                    Female
                  </GenderButton>
                  <GenderButton
                    selected={form.gender === 'O'}
                    onClick={() => handleGenderSelect('O')}
                    fullWidth
                  >
                    Other
                  </GenderButton>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        );
      
      case 2:
        return (
          <Stack spacing={4}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <LockIcon sx={{ fontSize: 48, color: isDark ? '#4299e1' : 'primary.main', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                Account Setup
              </Typography>
              <Typography variant="body1" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                Create login credentials for the worker
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StyledTextField
                  required
                  fullWidth
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Choose username *"
                  error={!!fieldErrors.username}
                  helperText={fieldErrors.username}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StyledTextField
                  required
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Create password *"
                  error={!!fieldErrors.password}
                  helperText={fieldErrors.password}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{ 
                            color: isDark ? '#a0aec0' : 'text.secondary',
                            backgroundColor: 'transparent !important',
                            border: 'none !important',
                            boxShadow: 'none !important',
                            padding: '8px',
                            margin: 0,
                            '&:hover': { 
                              color: theme.palette.mode === 'dark' ? '#4299e1' : 'primary.main',
                              backgroundColor: 'transparent !important',
                              boxShadow: 'none !important',
                            },
                            '&:focus': {
                              backgroundColor: 'transparent !important',
                              boxShadow: 'none !important',
                              outline: 'none',
                            },
                            '&:active': {
                              backgroundColor: 'transparent !important',
                              boxShadow: 'none !important',
                            },
                            '& .MuiTouchRipple-root': {
                              display: 'none',
                            }
                          }}
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
            
            {/* Summary Card */}
            <Paper sx={{ 
              p: 3, 
              borderRadius: 3, 
              bgcolor: '#f8fdf8',
              border: `1px solid var(--template-palette-success-main)`,
              boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.1)}`,
              '[data-mui-color-scheme="dark"] &': {
                bgcolor: '#1a202c',
                backgroundColor: '#1a202c',
                border: '1px solid #48bb78',
                boxShadow: '0 0 20px rgba(72, 187, 120, 0.2)',
              }
            }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                mb: 2, 
                color: 'var(--template-palette-success-main)',
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                '[data-mui-color-scheme="dark"] &': {
                  color: '#48bb78',
                }
              }}>
                <CheckCircleIcon />
                Registration Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ 
                    color: 'var(--template-palette-text-secondary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#a0aec0',
                    }
                  }}>Organization</Typography>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 600, 
                    color: 'var(--template-palette-text-primary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#ffffff',
                    }
                  }}>
                    {organizationName || 'Not available'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ 
                    color: 'var(--template-palette-text-secondary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#a0aec0',
                    }
                  }}>Full Name</Typography>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 600, 
                    color: 'var(--template-palette-text-primary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#ffffff',
                    }
                  }}>
                    {form.full_name || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ 
                    color: 'var(--template-palette-text-secondary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#a0aec0',
                    }
                  }}>Email</Typography>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 600, 
                    color: 'var(--template-palette-text-primary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#ffffff',
                    }
                  }}>
                    {form.email || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ 
                    color: 'var(--template-palette-text-secondary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#a0aec0',
                    }
                  }}>Username</Typography>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 600, 
                    color: 'var(--template-palette-text-primary)',
                    '[data-mui-color-scheme="dark"] &': {
                      color: '#ffffff',
                    }
                  }}>
                    {form.username || 'Not specified'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        );
      
      default:
        return null;
    }
  };

  return (
    <AppTheme>
      <SidebarProvider>
      <CalendarGlobalStyles />
      <CssBaseline enableColorScheme />
      <Box sx={{ display: 'flex' }}>
        <SideMenu />
        <AppNavbar />
        {/* Main content */}
        <Box
          component="main"
          sx={(theme) => ({
            flexGrow: 1,
            backgroundColor: theme.vars
              ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
              : alpha(theme.palette.background.default, 1),
            overflow: 'auto',
            minHeight: '100vh',
          })}
        >
          <Stack
            spacing={2}
            sx={{
              alignItems: 'center',
              mx: 3,
              pb: 5,
              mt: { xs: 8, md: 0 },
            }}
          >
            <Header />
            
            {/* Page Content */}
            <Box sx={{ width: '100%', maxWidth: 900 }}>
              <Stack spacing={4}>
                {/* Page Header */}
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: isDark ? '#ffffff' : 'text.primary', mb: 1 }}>
                      Add New Worker
                    </Typography>
                    <Typography variant="h6" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', fontWeight: 400 }}>
                      Register a new team member in a few simple steps
                    </Typography>
                  </Box>
                </Box>

                {/* Progress Stepper */}
                <Box sx={{ mb: 4 }}>
                  <ProgressStepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label, index) => {
                      const isActive = index === activeStep;
                      const isCompleted = index < activeStep;
                      
                      // Define icons for each step
                      const getStepIcon = (stepIndex: number) => {
                        switch (stepIndex) {
                          case 0:
                            return <BusinessIcon />;
                          case 1:
                            return <PersonIcon />;
                          case 2:
                            return <LockIcon />;
                          default:
                            return <CheckCircleIcon />;
                        }
                      };
                      
                      return (
                        <Step key={label}>
                          <StepLabel
                            StepIconComponent={() => (
                              <CustomStepIcon 
                                active={isActive} 
                                completed={isCompleted}
                              >
                                {getStepIcon(index)}
                              </CustomStepIcon>
                            )}
                            sx={{
                              '& .MuiStepLabel-label': {
                                fontWeight: 600,
                                fontSize: '1rem',
                              }
                            }}
                          >
                            {label}
                          </StepLabel>
                        </Step>
                      );
                    })}
                  </ProgressStepper>
                </Box>

                {/* Form Container */}
                <StepCard>
                  <form onSubmit={onSubmit}>
                    {renderStepContent(activeStep)}

                    {/* Navigation Buttons */}
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      mt: 4, 
                      pt: 3, 
                      borderTop: `1px solid ${isDark ? '#4a5568' : theme.palette.divider}` 
                    }}>
                      <Button
                        variant="outlined"
                        onClick={handleBack}
                        disabled={activeStep === 0}
                        startIcon={<ArrowBackIcon />}
                        sx={{
                          borderRadius: '12px',
                          px: 3,
                          py: 1.5,
                          textTransform: 'none',
                          fontWeight: 600,
                          border: `2px solid ${isDark ? '#4a5568' : theme.palette.divider}`,
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          '&:hover': {
                            border: `2px solid ${isDark ? '#4299e1' : theme.palette.primary.main}`,
                            color: isDark ? '#4299e1' : 'primary.main',
                            backgroundColor: alpha(isDark ? '#4299e1' : theme.palette.primary.main, 0.1),
                            transform: 'translateY(-2px)',
                            boxShadow: `0 8px 25px ${alpha(isDark ? '#4299e1' : theme.palette.primary.main, 0.15)}`,
                          },
                          '&.Mui-disabled': {
                            border: `2px solid ${isDark ? '#2d3748' : alpha(theme.palette.text.disabled, 0.3)}`,
                            color: isDark ? '#4a5568' : 'text.disabled',
                          }
                        }}
                      >
                        Back
                      </Button>
                      
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        {activeStep < steps.length - 1 ? (
                          <Button
                            variant="contained"
                            onClick={handleNext}
                            endIcon={<ArrowForwardIcon />}
                            sx={{
                              borderRadius: '12px',
                              px: 4,
                              py: 1.5,
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '1rem',
                              background: isDark ? '#ffffff' : theme.palette.primary.main,
                              color: isDark ? '#1a202c' : '#ffffff',
                              boxShadow: `0 4px 12px ${alpha(isDark ? '#ffffff' : theme.palette.primary.main, 0.25)}`,
                              outline: 'none',
                              border: 'none',
                              '&:hover': {
                                background: isDark ? '#90cdf4' : theme.palette.primary.dark,
                                color: isDark ? '#1a202c' : '#ffffff',
                                transform: 'translateY(-1px)',
                                boxShadow: `0 6px 20px ${alpha(isDark ? '#90cdf4' : theme.palette.primary.main, 0.3)}`,
                                outline: 'none',
                                border: 'none',
                              },
                              '&:focus': {
                                outline: 'none',
                                border: 'none',
                                boxShadow: `0 6px 20px ${alpha(isDark ? '#90cdf4' : theme.palette.primary.main, 0.3)}`,
                              },
                              '&:active': {
                                outline: 'none',
                                border: 'none',
                              }
                            }}
                          >
                            Continue
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            variant="contained"
                            disabled={submitting}
                            endIcon={<CheckCircleIcon />}
                            sx={{
                              borderRadius: '12px',
                              px: 4,
                              py: 1.5,
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '1rem',
                              background: isDark 
                                ? 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'
                                : `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                              color: '#ffffff',
                              boxShadow: `0 8px 25px ${alpha(isDark ? '#48bb78' : theme.palette.success.main, 0.25)}`,
                              outline: 'none',
                              border: 'none',
                              '&:hover': {
                                background: isDark
                                  ? 'linear-gradient(135deg, #38a169 0%, #2f855a 100%)'
                                  : `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.dark} 100%)`,
                                transform: 'translateY(-2px)',
                                boxShadow: `0 12px 30px ${alpha(isDark ? '#48bb78' : theme.palette.success.main, 0.35)}`,
                                outline: 'none',
                                border: 'none',
                              },
                              '&:focus': {
                                outline: 'none',
                                border: 'none',
                                boxShadow: `0 12px 30px ${alpha(isDark ? '#48bb78' : theme.palette.success.main, 0.35)}`,
                              },
                              '&:active': {
                                outline: 'none',
                                border: 'none',
                              },
                              '&.Mui-disabled': {
                                background: isDark ? '#4a5568' : theme.palette.action.disabled,
                                color: isDark ? '#718096' : theme.palette.action.disabled,
                              }
                            }}
                          >
                            {submitting ? 'Registering...' : 'Register Worker'}
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </form>
                </StepCard>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Toast Notifications */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{
            width: '100%',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '1rem',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
      </SidebarProvider>
    </AppTheme>
  );
}