import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input({ className = '', invalid, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`form-control${invalid ? ' form-control-invalid' : ''}${className ? ` ${className}` : ''}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
