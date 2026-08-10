import React from 'react';

const TONES = {
  green: 'badge-aprovada',
  red: 'badge-rejeitada',
  yellow: 'badge-pendente',
  blue: 'badge-em_analise',
  gray: 'badge-cancelada',
};

export function Badge({ tone = 'gray', children, className = '' }) {
  return (
    <span className={`badge ${TONES[tone] || TONES.gray}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
