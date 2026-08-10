import React, { forwardRef } from 'react';

export const Select = forwardRef(function Select({ className = '', invalid, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={`form-control form-select${invalid ? ' form-control-invalid' : ''}${className ? ` ${className}` : ''}`}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
});
