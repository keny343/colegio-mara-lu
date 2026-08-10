import React, { useMemo } from 'react';

function buildPages(page, totalPages) {
  const pages = [];
  const add = (p, ellipsis) => {
    if (ellipsis) {
      if (pages[pages.length - 1] !== '…') pages.push('…');
    } else if (!pages.includes(p)) {
      pages.push(p);
    }
  };

  add(1);
  if (page > 3) add(null, true);
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) add(p);
  if (page < totalPages - 2) add(null, true);
  if (totalPages > 1) add(totalPages);
  return pages;
}

export function Pagination({ page = 1, pageSize = 10, total = 0, onPageChange, showTotal = true }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pages = useMemo(() => buildPages(page, totalPages), [page, totalPages]);

  if (totalPages <= 1) {
    if (!showTotal) return null;
    return (
      <div className="pagination" aria-label="Paginação">
        <span className="pagination-info">Total: {total} registo(s)</span>
      </div>
    );
  }

  return (
    <div className="pagination" aria-label="Paginação">
      <button
        type="button"
        className="page-btn"
        disabled={page <= 1}
        aria-label="Página anterior"
        onClick={() => onPageChange?.(page - 1)}
      >
        &lsaquo;
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="page-ellipsis" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`page-btn${p === page ? ' page-btn-active' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Página ${p}`}
            onClick={() => onPageChange?.(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        className="page-btn"
        disabled={page >= totalPages}
        aria-label="Página seguinte"
        onClick={() => onPageChange?.(page + 1)}
      >
        &rsaquo;
      </button>
      {showTotal && <span className="pagination-info">{total} registo(s)</span>}
    </div>
  );
}
