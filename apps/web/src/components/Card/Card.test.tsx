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

  it('renders the parent title when provided', () => {
    render(() => <Card {...defaultProps} parentTitle="Project Alpha" />);
    expect(screen.getByText('Project Alpha /')).toBeInTheDocument();
  });

  it('applies blocked styles and renders reason when blocked', () => {
    const { container } = render(() => (
      <Card {...defaultProps} state="blocked" blockerReason="Waiting for API" />
    ));

    expect(screen.getByText('Waiting for API')).toBeInTheDocument();

    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement).toHaveClass('border-status-blocked');
  });

  it('applies delayed styles when delayed', () => {
    const { container } = render(() => (
      <Card {...defaultProps} state="delayed" />
    ));

    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement).toHaveClass('border-status-doing/50');
  });

  it('renders subtasks count when provided', () => {
    render(() => <Card {...defaultProps} subtasksCount={2} totalSubtasks={5} />);
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });
});
