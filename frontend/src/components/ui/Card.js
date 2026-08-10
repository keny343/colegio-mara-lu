import React from 'react';

export function Card({ title, actions, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`card${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
