import React, { forwardRef } from 'react';

export const Textarea = forwardRef(function Textarea({ className = '', invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`form-control${invalid ? ' form-control-invalid' : ''}${className ? ` ${className}` : ''}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
