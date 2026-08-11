import React, { useMemo, useState } from 'react';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt', { numeric: true });
}

export function DataTable({
  columns = [],
  rows = [],
  keyField = 'id',
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'Sem registos',
  sortable = true,
  sortKey,
  sortDir,
  onSortChange,
  className = '',
}) {
  const [localSortKey, setLocalSortKey] = useState(null);
  const [localSortDir, setLocalSortDir] = useState('asc');

  const activeSortKey = onSortChange ? sortKey : localSortKey;
  const activeSortDir = onSortChange ? sortDir : localSortDir;

  const sortedRows = useMemo(() => {
    if (!activeSortKey) return rows;
    const column = columns.find((c) => c.key === activeSortKey);
    const valueOf = (row) =>
      column?.sortValue ? column.sortValue(row) : row[activeSortKey];
    return [...rows].sort((a, b) => {
      const result = compareValues(valueOf(a), valueOf(b));
      return activeSortDir === 'asc' ? result : -result;
    });
  }, [rows, columns, activeSortKey, activeSortDir]);

  const handleSort = (column) => {
    if (!column.sortable || !sortable) return;
    let dir = 'asc';
    if (activeSortKey === column.key) dir = activeSortDir === 'asc' ? 'desc' : 'asc';
    if (onSortChange) {
      onSortChange(column.key, dir);
    } else {
      setLocalSortKey(column.key);
      setLocalSortDir(dir);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div className={`table-wrap${className ? ` ${className}` : ''}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => {
              const isActive = activeSortKey === column.key;
              const canSort = column.sortable && sortable;
              return (
                <th
                  key={column.key}
                  className={column.headerClassName || ''}
                  style={column.headerWidth ? { width: column.headerWidth } : undefined}
                  aria-sort={
                    !canSort
                      ? undefined
                      : isActive
                        ? activeSortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                >
                  {canSort ? (
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort(column)}
                    >
                      {column.label}
                      <span className="table-sort-indicator" aria-hidden="true">
                        {isActive ? (activeSortDir === 'asc' ? ' \u2191' : ' \u2193') : ''}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => (
            <tr key={row?.[keyField] ?? rowIndex} className={row.rowClassName}>
              {columns.map((column) => (
                <td key={column.key} className={column.cellClassName || ''} data-label={column.label}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
