import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import CollaborationToast from './CollaborationToast';

function dispatchBoardEvent(detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent('kanbrio:board:event', { detail }));
}

describe('CollaborationToast', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(() => <CollaborationToast />);
    const region = container.querySelector('[role="status"]');
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('shows toast on card_moved event', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'card_moved',
      card: { id: '1', title: 'Fix login bug' },
    });
    await waitFor(() => {
      expect(screen.getByText('Card moved: Fix login bug')).toBeInTheDocument();
    });
  });

  it('shows toast on card_created event', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'card_created',
      card: { id: '2', title: 'New feature' },
    });
    await waitFor(() => {
      expect(screen.getByText('Card created: New feature')).toBeInTheDocument();
    });
  });

  it('shows toast on card_blocked event', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'card_blocked',
      card: { id: '3', title: 'Implement API' },
    });
    await waitFor(() => {
      expect(screen.getByText('Card blocked: Implement API')).toBeInTheDocument();
    });
  });

  it('shows toast on card_unblocked event', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'card_unblocked',
      card: { id: '3', title: 'Implement API' },
    });
    await waitFor(() => {
      expect(screen.getByText('Card unblocked: Implement API')).toBeInTheDocument();
    });
  });

  it('shows toast on card_assigned event', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'card_assigned',
      card: { id: '4', title: 'Fix bug' },
    });
    await waitFor(() => {
      expect(screen.getByText('Card assigned: Fix bug')).toBeInTheDocument();
    });
  });

  it('shows toast on checklist_item_updated with completed item', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'checklist_item_updated',
      item: { id: 'c1', title: 'Write tests', is_completed: true },
    });
    await waitFor(() => {
      expect(screen.getByText('Checklist completed: Write tests')).toBeInTheDocument();
    });
  });

  it('shows toast on block_comment_added event with preview', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'block_comment_added',
      comment: { id: 'cm1', content: 'Waiting for API changes', user_id: 'u1' },
      card: { id: '5', title: 'Refactor module' },
    });
    await waitFor(() => {
      expect(
        screen.getByText('Comment on Refactor module: Waiting for API changes'),
      ).toBeInTheDocument();
    });
  });

  it('truncates long comment content to 50 chars', async () => {
    render(() => <CollaborationToast />);
    const longComment = 'A very long comment that should definitely exceed the fifty character limit for truncation testing purposes';
    dispatchBoardEvent({
      type: 'block_comment_added',
      comment: { id: 'cm2', content: longComment, user_id: 'u1' },
      card: { id: '6', title: 'Fix bug' },
    });
    await waitFor(() => {
      const text = screen.getByText(/Comment on Fix bug:/);
      expect(text.textContent!.length).toBeLessThan(longComment.length + 20);
      expect(text.textContent).toContain('…');
    });
  });

  it('ignores user_joined and user_left events', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({ type: 'user_joined', user_id: 'u1', username: 'Alice' });
    dispatchBoardEvent({ type: 'user_left', user_id: 'u1' });
    await waitFor(() => {
      expect(screen.queryAllByLabelText('Dismiss notification').length).toBe(0);
    });
  });

  it('ignores unknown event types', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({ type: 'unknown_type', some: 'data' });
    await waitFor(() => {
      expect(screen.queryAllByLabelText('Dismiss notification').length).toBe(0);
    });
  });

  it('handles missing card title gracefully', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({ type: 'card_moved', card: { id: '1' } });
    await waitFor(() => {
      expect(screen.getByText('Card moved')).toBeInTheDocument();
    });
  });

  it('dismisses toast on close button click', async () => {
    render(() => <CollaborationToast />);
    dispatchBoardEvent({
      type: 'card_moved',
      card: { id: '1', title: 'Dismiss me' },
    });
    expect(await screen.findByText('Card moved: Dismiss me')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss notification');
    dismissBtn.click();

    await waitFor(() => {
      expect(screen.queryByText('Card moved: Dismiss me')).not.toBeInTheDocument();
    });
  });

  it('limits visible toasts to 3', async () => {
    render(() => <CollaborationToast />);
    for (let i = 0; i < 5; i++) {
      dispatchBoardEvent({
        type: 'card_moved',
        card: { id: String(i), title: `Card ${i}` },
      });
    }
    await waitFor(() => {
      const buttons = screen.queryAllByLabelText('Dismiss notification');
      expect(buttons.length).toBe(3);
    });
  });
});
