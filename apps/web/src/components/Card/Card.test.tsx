import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import Card from './Card';

describe('Card Component', () => {
  const defaultProps = {
    id: 'KNB-101',
    fullId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Card Title',
  };

  it('renders the card title', () => {
    render(() => <Card {...defaultProps} />);
    expect(screen.getByText('Test Card Title')).toBeInTheDocument();
  });

  it('renders the card ID', () => {
    render(() => <Card {...defaultProps} />);
    expect(screen.getByText('KNB-101')).toBeInTheDocument();
  });

  it('renders the parent badge when parentTitle and parentId are provided', () => {
    render(() => <Card {...defaultProps} parentTitle="Project Alpha" parentId="parent-uuid" />);
    const badge = screen.getByTestId('card-parent-badge-550e8400-e29b-41d4-a716-446655440000');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('↑ Project Alpha');
  });

  it('truncates the parent title to 20 characters with ellipses if it is longer than 20 characters', () => {
    render(() => (
      <Card
        {...defaultProps}
        parentTitle="Very Long Project Title That Exceeds Twenty Characters"
        parentId="parent-uuid"
      />
    ));
    const badge = screen.getByTestId('card-parent-badge-550e8400-e29b-41d4-a716-446655440000');
    expect(badge).toHaveTextContent('↑ Very Long Proje...');
  });

  it('applies blocked styles and renders reason when blocked', () => {
    const { container } = render(() => (
      <Card {...defaultProps} isBlocked={true} blockerReason="Waiting for API" />
    ));

    expect(screen.getByText('Blocked: Waiting for API')).toBeInTheDocument();

    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement).toHaveClass('border-status-blocked');
  });

  it('renders subtask count badge and progress bar when subtasks are present', () => {
    render(() => <Card {...defaultProps} subtasksCount={2} totalSubtasks={5} />);
    const countBadge = screen.getByTestId('card-children-badge-550e8400-e29b-41d4-a716-446655440000');
    expect(countBadge).toBeInTheDocument();
    expect(countBadge).toHaveTextContent('⑆ 2/5');

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');
  });

  it('renders direct subtask titles and status tag capsules in the tooltip', () => {
    const subtasks = [
      { id: '1', title: 'Subtask One', isDone: true, columnName: 'Done' },
      { id: '2', title: 'Subtask Two', isDone: false, columnName: 'Todo' },
    ];
    render(() => <Card {...defaultProps} subtasksCount={1} totalSubtasks={2} subtasks={subtasks} />);
    expect(screen.getByText('Subtask One')).toBeInTheDocument();
    expect(screen.getByText('Subtask Two')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();
  });
});
