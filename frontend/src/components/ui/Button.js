import React from 'react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
};

export function Button({
  variant = 'primary',
  size,
  block = false,
  loading = false,
  icon,
  iconOnly = false,
  children,
  className = '',
  type = 'button',
  disabled,
  ...rest
}) {
  const classes = [
    'btn',
    VARIANTS[variant] || VARIANTS.primary,
    size === 'sm' ? 'btn-sm' : '',
    iconOnly ? 'btn-icon' : '',
    block ? 'btn-full' : '',
    loading ? 'btn-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
