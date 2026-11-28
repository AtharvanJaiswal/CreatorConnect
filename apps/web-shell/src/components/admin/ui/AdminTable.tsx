'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
}

export function AdminTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found matching criteria.',
  onRowClick,
  pagination,
}: AdminTableProps<T>) {
  return (
    <div
      className="w-full flex flex-col bg-white border border-[#E7E0D5] rounded-2xl overflow-hidden shadow-[0_4px_16px_rgba(20,17,15,0.02)]"
      aria-busy={isLoading}
    >
      <div
        role="region"
        aria-label="Administrative records table"
        tabIndex={0}
        className="overflow-x-auto custom-scrollbar min-h-[440px]"
      >
        <table className="w-full border-collapse text-left font-sans-body">
          <thead>
            <tr className="bg-[#FAF6EF] border-b border-[#E7E0D5]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`py-3.5 px-4 text-xs font-bold text-[#6F675E] uppercase tracking-wider whitespace-nowrap ${
                    col.headerClassName || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE9DF]">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, skeletonIdx) => (
                <tr
                  key={`skeleton-${skeletonIdx}`}
                  aria-hidden="true"
                  data-testid="admin-table-skeleton-row"
                  className="h-14"
                >
                  {columns.map((col) => (
                    <td
                      key={`${col.key}-${skeletonIdx}`}
                      className={`py-3 px-4 ${col.className || ''}`}
                    >
                      <div className="h-4 w-3/4 rounded-md bg-[#EFE9DF] animate-pulse motion-reduce:animate-none" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr className="h-[392px]">
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-[#6F675E] align-middle"
                >
                  <div className="flex flex-col items-center justify-center gap-2" role="status">
                    <Inbox className="w-8 h-8 text-[#A39A8F]" aria-hidden="true" />
                    <span className="text-sm font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`min-h-14 transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-[#FDFBF7]' : 'hover:bg-[#FAF6EF]/50'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-4 text-sm text-[#14110F] ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, idx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#FAF6EF] border-t border-[#E7E0D5] text-xs font-semibold text-[#6F675E]">
          <span>
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="px-3 py-1 rounded-full border border-[#E7E0D5] bg-white text-[#14110F] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2ECE1]"
            >
              Previous
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-3 py-1 rounded-full border border-[#E7E0D5] bg-white text-[#14110F] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F2ECE1]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
