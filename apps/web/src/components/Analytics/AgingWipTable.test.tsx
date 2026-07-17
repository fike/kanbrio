import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { AgingWipTable } from './AgingWipTable';
import type { AgingWipCard } from '../../api/analytics';

describe('AgingWipTable', () => {
  it('renders loading spinner', () => {
    render(() => <AgingWipTable data={[]} totalCards={0} loading={true} error={null} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders error banner', () => {
    render(() => <AgingWipTable data={[]} totalCards={0} loading={false} error={new Error('fail')} />);
    expect(screen.getByText('Failed to load aging WIP data')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(() => <AgingWipTable data={[]} totalCards={5} loading={false} error={null} />);
    expect(screen.getByText('No stagnant cards')).toBeInTheDocument();
  });

  it('renders total card count', () => {
    render(() => <AgingWipTable data={[]} totalCards={12} loading={false} error={null} />);
    expect(screen.getByText(/12 cards/)).toBeInTheDocument();
  });

  it('renders stagnant count in subtitle', () => {
    const cards: AgingWipCard[] = [
      { card_id: 'c1', title: 'Stale Card', column_title: 'Doing', assignee_name: 'Alice', idle_hours: 96, idle_days: 4, entered_column_at: '' },
    ];
    render(() => <AgingWipTable data={cards} totalCards={10} loading={false} error={null} />);
    expect(screen.getByText(/1 stagnant/)).toBeInTheDocument();
  });

  it('renders card rows with idle time', () => {
    const cards: AgingWipCard[] = [
      { card_id: 'c1', title: 'Bug Fix', column_title: 'Review', assignee_name: 'Bob', idle_hours: 50, idle_days: 2, entered_column_at: '' },
      { card_id: 'c2', title: 'Feature X', column_title: 'Doing', assignee_name: null, idle_hours: 200, idle_days: 8, entered_column_at: '' },
    ];
    render(() => <AgingWipTable data={cards} totalCards={5} loading={false} error={null} />);
    expect(screen.getByText('Bug Fix')).toBeInTheDocument();
    expect(screen.getByText('Feature X')).toBeInTheDocument();
    expect(screen.getByText('2d 2h')).toBeInTheDocument();
    expect(screen.getByText('8d 8h')).toBeInTheDocument();
  });

  it('renders em dash for null assignee', () => {
    const cards: AgingWipCard[] = [
      { card_id: 'c1', title: 'Task', column_title: 'Doing', assignee_name: null, idle_hours: 24, idle_days: 1, entered_column_at: '' },
    ];
    render(() => <AgingWipTable data={cards} totalCards={1} loading={false} error={null} />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('applies warning color for idle 7-13 days', () => {
    const cards: AgingWipCard[] = [
      { card_id: 'c1', title: 'Warning', column_title: 'Doing', assignee_name: null, idle_hours: 190, idle_days: 7, entered_column_at: '' },
    ];
    render(() => <AgingWipTable data={cards} totalCards={1} loading={false} error={null} />);
    const cell = screen.getByText('7d 22h');
    expect(cell.className).toContain('text-status-doing');
  });

  it('applies danger color for idle 14+ days', () => {
    const cards: AgingWipCard[] = [
      { card_id: 'c1', title: 'Critical', column_title: 'Doing', assignee_name: null, idle_hours: 340, idle_days: 14, entered_column_at: '' },
    ];
    render(() => <AgingWipTable data={cards} totalCards={1} loading={false} error={null} />);
    const cell = screen.getByText('14d 4h');
    expect(cell.className).toContain('text-status-blocked');
  });

  it('prioritizes loading over error', () => {
    render(() => <AgingWipTable data={[]} totalCards={0} loading={true} error={new Error('err')} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load aging WIP data')).not.toBeInTheDocument();
  });

  it('has data-testid on table rows', () => {
    const cards: AgingWipCard[] = [
      { card_id: 'c1', title: 'Task', column_title: 'Doing', assignee_name: 'A', idle_hours: 24, idle_days: 1, entered_column_at: '' },
    ];
    render(() => <AgingWipTable data={cards} totalCards={1} loading={false} error={null} />);
    expect(screen.getByTestId('aging-wip-row-c1')).toBeInTheDocument();
  });
});
