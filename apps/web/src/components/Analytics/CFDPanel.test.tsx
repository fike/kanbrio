import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { CFDPanel } from './CFDPanel';
import type { CFDResponse } from '../../api/analytics';

vi.mock('chart.js', () => {
  function Chart() {
    return { destroy: vi.fn() };
  }
  Chart.register = vi.fn();
  return { Chart, registerables: [] };
});

describe('CFDPanel', () => {
  it('renders loading spinner', () => {
    render(() => <CFDPanel data={null} loading={true} error={null} />);
    expect(screen.getByText('Loading chart...')).toBeInTheDocument();
  });

  it('renders error banner', () => {
    render(() => <CFDPanel data={null} loading={false} error={new Error('fail')} />);
    expect(screen.getByText('Failed to load CFD data')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(() => <CFDPanel data={{ columns: [], data_points: [] }} loading={false} error={null} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders chart title', () => {
    render(() => <CFDPanel data={null} loading={false} error={null} />);
    expect(screen.getByText('Cumulative Flow Diagram')).toBeInTheDocument();
  });

  it('renders with data', () => {
    const data: CFDResponse = {
      columns: [{ id: 'c1', title: 'Doing', color: '#ff0' }],
      data_points: [
        { date: '2026-07-01', counts: { c1: 5 } },
        { date: '2026-07-02', counts: { c1: 3 } },
      ],
    };
    render(() => <CFDPanel data={data} loading={false} error={null} />);
    expect(screen.getByText('Cumulative Flow Diagram')).toBeInTheDocument();
  });
});
