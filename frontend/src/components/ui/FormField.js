import React from 'react';

export function FormField({ label, htmlFor, required, error, hint, children, className = '' }) {
  return (
    <div className={`form-group${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="form-required" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : hint ? (
        <p className="form-hint">{hint}</p>
      ) : null}
    </div>
  );
}
