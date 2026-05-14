/**
 * Validates password strength based on security principles:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export const isPasswordStrong = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigits = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) return { isValid: false, message: 'Password must be at least 8 characters long' };
  if (!hasUpperCase) return { isValid: false, message: 'Password must include at least one uppercase letter' };
  if (!hasLowerCase) return { isValid: false, message: 'Password must include at least one lowercase letter' };
  if (!hasDigits) return { isValid: false, message: 'Password must include at least one number' };
  if (!hasSpecialChar) return { isValid: false, message: 'Password must include at least one special character' };

  return { isValid: true };
};
