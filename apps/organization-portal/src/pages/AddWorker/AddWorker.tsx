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
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import AppNavbar from '../../components/dash_comp/AppNavbar';
import SideMenu from '../../components/dash_comp/SideMenu';
import Header from '../../components/dash_comp/Header';
import AppTheme from '../../theme/dash_theme/AppTheme';
import { registerWorker } from '../../services/workerService';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
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

// Styled Components
const StyledTextField = styled(TextField)(({ theme, error }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '16px',
    backgroundColor: '#1a1a1a',
    border: `2px solid ${error ? '#ef4444' : alpha('#3b82f6', 0.3)}`,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: '#ffffff',
    // Completely disable autocomplete styling
    '&[data-autocompleted]': {
      backgroundColor: '#1a1a1a !important',
      backgroundImage: 'none !important',
      boxShadow: 'none !important',
    },
    '& input': {
      color: '#ffffff',
      fontSize: '1rem',
      padding: '16px 14px',
      // Date picker specific styling
      '&[type="date"]': {
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        letterSpacing: '0.5px',
        '&::-webkit-calendar-picker-indicator': {
          backgroundColor: 'transparent',
          cursor: 'pointer',
          filter: 'invert(1) brightness(0.8)',
          borderRadius: '8px',
          padding: '4px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: alpha('#3b82f6', 0.2),
            filter: 'invert(0.4) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.2)',
            transform: 'scale(1.1)',
          },
        },
        '&::-webkit-inner-spin-button': {
          display: 'none',
        },
        '&::-webkit-clear-button': {
          display: 'none',
        },
      },
      '&:-webkit-autofill': {
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        WebkitTextFillColor: '#ffffff !important',
        borderRadius: '16px',
        transition: 'background-color 5000s ease-in-out 0s',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        boxShadow: 'none !important',
      },
      '&:-webkit-autofill:hover': {
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        boxShadow: 'none !important',
      },
      '&:-webkit-autofill:focus': {
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        boxShadow: 'none !important',
      },
      '&:-webkit-autofill:active': {
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        boxShadow: 'none !important',
      },
      // Additional autocomplete overrides
      '&:-moz-autofill': {
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        boxShadow: 'none !important',
        color: '#ffffff !important',
      },
      '&:-ms-input-placeholder': {
        color: '#9ca3af !important',
      },
      '&::-webkit-input-placeholder': {
        color: '#9ca3af !important',
      },
      '&::-moz-placeholder': {
        color: '#9ca3af !important',
      },
    },
    '& input::placeholder': {
      color: '#9ca3af',
      opacity: 1,
    },
    '&:hover': {
      border: `2px solid ${error ? '#ef4444' : alpha('#3b82f6', 0.5)}`,
      backgroundColor: '#242424',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(error ? '#ef4444' : '#3b82f6', 0.15)}`,
    },
    '&.Mui-focused': {
      border: `2px solid ${error ? '#ef4444' : '#3b82f6'}`,
      backgroundColor: '#242424',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(error ? '#ef4444' : '#3b82f6', 0.25)}`,
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
  },
  '& .MuiInputLabel-root': {
    display: 'none', // Hide the label completely
  },
  '& .MuiInputAdornment-root svg': {
    color: error ? '#ef4444' : '#3b82f6',
    fontSize: '1.25rem',
  },
  '& .MuiFormHelperText-root': {
    color: '#ef4444',
    fontWeight: 500,
    marginLeft: '8px',
    marginTop: '8px',
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
  border: `2px solid ${selected ? '#3b82f6' : alpha('#3b82f6', 0.3)}`,
  backgroundColor: selected ? alpha('#3b82f6', 0.2) : '#1a1a1a',
  color: selected ? '#3b82f6' : '#e5e7eb',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    border: `2px solid #3b82f6`,
    backgroundColor: alpha('#3b82f6', 0.2),
    color: '#3b82f6',
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 25px ${alpha('#3b82f6', 0.15)}`,
  },
}));

const StepCard = styled(Paper)(({ theme }) => ({
  borderRadius: '24px',
  padding: '40px',
  background: '#1f1f1f',
  border: `1px solid ${alpha('#3b82f6', 0.2)}`,
  boxShadow: `0 20px 40px ${alpha('#000000', 0.3)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
}));

const ProgressStepper = styled(Stepper)(({ theme }) => ({
  '& .MuiStepLabel-root .MuiStepLabel-iconContainer .MuiSvgIcon-root': {
    fontSize: '2rem',
    color: alpha('#3b82f6', 0.4),
  },
  '& .MuiStepLabel-root.Mui-active .MuiStepLabel-iconContainer .MuiSvgIcon-root': {
    color: '#3b82f6',
    animation: 'pulse 2s infinite',
  },
  '& .MuiStepLabel-root.Mui-completed .MuiStepLabel-iconContainer .MuiSvgIcon-root': {
    color: '#10b981',
  },
  '& .MuiStepLabel-label': {
    color: '#e5e7eb !important',
    fontWeight: '600 !important',
  },
  '& .MuiStepLabel-label.Mui-active': {
    color: '#3b82f6 !important',
  },
  '& .MuiStepLabel-label.Mui-completed': {
    color: '#10b981 !important',
  },
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(1)',
    },
    '50%': {
      transform: 'scale(1.1)',
    },
    '100%': {
      transform: 'scale(1)',
    },
  },
}));

// Modern Calendar Picker Global Styles
const calendarGlobalStyles = (
  <GlobalStyles
    styles={{
      // WebKit Calendar Picker (Chrome, Safari, Edge)
      'input[type="date"]::-webkit-calendar-picker-indicator': {
        cursor: 'pointer',
        filter: 'invert(0.8) brightness(1.1)',
        borderRadius: '6px',
        padding: '4px',
        transition: 'all 0.3s ease',
        marginLeft: 'auto',
        '&:hover': {
          filter: 'invert(0.4) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.4)',
          transform: 'scale(1.1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
        },
      },
      
      // Native date input styling improvements
      'input[type="date"]': {
        colorScheme: 'dark',
        position: 'relative',
        cursor: 'pointer',
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
          color: '#ffffff',
          fontWeight: '500',
        },
        '&::-webkit-datetime-edit-fields-wrapper': {
          padding: '0',
        },
        '&::-webkit-datetime-edit-text': {
          color: '#9ca3af',
          padding: '0 2px',
        },
        '&::-webkit-datetime-edit-month-field': {
          color: '#ffffff',
        },
        '&::-webkit-datetime-edit-day-field': {
          color: '#ffffff',
        },
        '&::-webkit-datetime-edit-year-field': {
          color: '#ffffff',
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

export default function AddWorker() {
  const [activeStep, setActiveStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [form, setForm] = useState({
    org_name: '',
    username: '',
    password: '',
    email: '',
    full_name: '',
    phone_number: '',
    gender: 'M',
    dob: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const steps = ['Organization Info', 'Personal Details', 'Account Setup'];

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent form submission when Enter is pressed in text fields
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleGenderSelect = (gender: string) => {
    setForm((f) => ({ ...f, gender }));
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
        if (!form.org_name.trim()) {
          errors.org_name = 'Organization name is required';
          isValid = false;
        }
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
      // Reset form except org_name
      setForm((f) => ({ ...f, username: '', password: '', email: '', full_name: '', phone_number: '', dob: '' }));
      setActiveStep(0);
    } catch (err: any) {
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
              <BusinessIcon sx={{ fontSize: 48, color: '#3b82f6', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#ffffff' }}>
                Organization Information
              </Typography>
              <Typography variant="body1" sx={{ color: '#9ca3af' }}>
                Let's start with your organization details
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <StyledTextField
                  required
                  fullWidth
                  name="org_name"
                  value={form.org_name}
                  onChange={onChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter organization name *"
                  error={!!fieldErrors.org_name}
                  helperText={fieldErrors.org_name}
                  InputProps={{
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
              <PersonIcon sx={{ fontSize: 48, color: '#3b82f6', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#ffffff' }}>
                Personal Details
              </Typography>
              <Typography variant="body1" sx={{ color: '#9ca3af' }}>
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& input[type="date"]': {
                        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                        fontWeight: 500,
                        cursor: 'pointer',
                        '&::-webkit-calendar-picker-indicator': {
                          marginLeft: 'auto',
                          marginRight: '8px',
                          cursor: 'pointer',
                          filter: 'invert(0.7) brightness(1.2)',
                          borderRadius: '4px',
                          padding: '4px',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            filter: 'invert(0.4) sepia(1) saturate(3) hue-rotate(200deg) brightness(1.3)',
                            transform: 'scale(1.1)',
                          },
                        },
                      },
                    },
                  }}
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
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#ffffff' }}>
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
              <LockIcon sx={{ fontSize: 48, color: '#3b82f6', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#ffffff' }}>
                Account Setup
              </Typography>
              <Typography variant="body1" sx={{ color: '#9ca3af' }}>
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
            color: '#9ca3af',
            backgroundColor: 'transparent !important',
            border: 'none !important',
            boxShadow: 'none !important',
            padding: '8px',
            margin: 0,
            '&:hover': { 
              color: '#3b82f6',
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
              display: 'none', // Remove ripple effect
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
              bgcolor: '#0f1419', 
              border: '1px solid #10b981',
              boxShadow: `0 0 20px ${alpha('#10b981', 0.1)}`
            }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#10b981', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon />
                Registration Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>Organization</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff' }}>{form.org_name || 'Not specified'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>Full Name</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff' }}>{form.full_name || 'Not specified'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>Email</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff' }}>{form.email || 'Not specified'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" sx={{ color: '#9ca3af' }}>Username</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffffff' }}>{form.username || 'Not specified'}</Typography>
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
      {calendarGlobalStyles}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PersonAddAlt1Icon sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: '#ffffff', mb: 1 }}>
                        Add New Worker
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#9ca3af', fontWeight: 400 }}>
                        Register a new team member in a few simple steps
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Progress Stepper */}
                <Box sx={{ mb: 4 }}>
                  <ProgressStepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label, index) => (
                      <Step key={label}>
                        <StepLabel
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
                    ))}
                  </ProgressStepper>
                </Box>

                {/* Form Container */}
                <StepCard>
                  <form onSubmit={onSubmit}>
                    {renderStepContent(activeStep)}

                    {/* Navigation Buttons */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 3, borderTop: '1px solid #374151' }}>
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
                          border: '2px solid #374151',
                          color: '#9ca3af',
                          '&:hover': {
                            border: '2px solid #3b82f6',
                          color: '#3b82f6',
                          backgroundColor: alpha('#3b82f6', 0.1),
                          transform: 'translateY(-2px)',
                          boxShadow: `0 8px 25px ${alpha('#3b82f6', 0.15)}`,
                        },
                        '&.Mui-disabled': {
                          border: '2px solid #1f2937',
                          color: '#4b5563',
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
                            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                            color: '#ffffff',
                            boxShadow: `0 8px 25px ${alpha('#3b82f6', 0.25)}`,
                            '&:hover': {
                              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                              transform: 'translateY(-2px)',
                              boxShadow: `0 12px 30px ${alpha('#3b82f6', 0.35)}`,
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
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            boxShadow: `0 8px 25px ${alpha('#10b981', 0.25)}`,
                            '&:hover': {
                              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                              transform: 'translateY(-2px)',
                              boxShadow: `0 12px 30px ${alpha('#10b981', 0.35)}`,
                            },
                            '&.Mui-disabled': {
                              background: '#374151',
                              color: '#6b7280',
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
    </AppTheme>
  );
}
