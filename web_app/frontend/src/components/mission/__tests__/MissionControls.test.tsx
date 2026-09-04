import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionControls } from '../MissionControls';

describe('MissionControls Component', () => {
  it('renders default ready state with inputs and buttons', () => {
    render(<MissionControls />);

    expect(screen.getByText('Mission Controls')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByLabelText(/X \(m\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Y \(m\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Z \(m\)/)).toBeInTheDocument();
    expect(screen.getByText('Trigger E-Stop')).toBeInTheDocument();
  });

  it('validates coordinate inputs and calls onSetGoal when form submitted', () => {
    const onSetGoal = vi.fn();
    render(<MissionControls onSetGoal={onSetGoal} />);

    const xInput = screen.getByLabelText(/X \(m\)/);
    const yInput = screen.getByLabelText(/Y \(m\)/);
    const zInput = screen.getByLabelText(/Z \(m\)/);
    const frameInput = screen.getByLabelText(/Frame:/);

    fireEvent.change(xInput, { target: { value: '12.5' } });
    fireEvent.change(yInput, { target: { value: '-3.2' } });
    fireEvent.change(zInput, { target: { value: '0.0' } });
    fireEvent.change(frameInput, { target: { value: 'odom' } });

    const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
    expect(dispatchBtn).not.toBeDisabled();
    fireEvent.click(dispatchBtn);

    expect(onSetGoal).toHaveBeenCalledWith({
      x: 12.5,
      y: -3.2,
      z: 0.0,
      frameId: 'odom',
    });
  });

  it('requires confirmation before triggering software E-Stop', () => {
    const onSoftwareEstop = vi.fn();
    render(<MissionControls onSoftwareEstop={onSoftwareEstop} />);

    const triggerBtn = screen.getByText('Trigger E-Stop');
    fireEvent.click(triggerBtn);

    // Confirmation gate appears
    expect(
      screen.getByText('Confirm: Trigger emergency software stop?'),
    ).toBeInTheDocument();
    expect(onSoftwareEstop).not.toHaveBeenCalled();

    // Clicking Confirm Stop executes the callback
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Stop' });
    fireEvent.click(confirmBtn);

    expect(onSoftwareEstop).toHaveBeenCalledTimes(1);
  });

  it('allows cancelling software E-Stop confirmation', () => {
    const onSoftwareEstop = vi.fn();
    render(<MissionControls onSoftwareEstop={onSoftwareEstop} />);

    fireEvent.click(screen.getByText('Trigger E-Stop'));
    expect(screen.getByText('Confirm Stop')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Confirm Stop')).not.toBeInTheDocument();
    expect(onSoftwareEstop).not.toHaveBeenCalled();
  });

  it('displays command status and reason banner when rejected or failed', () => {
    render(
      <MissionControls
        commandStatus="rejected"
        lastCommandType="set_goal"
        lastCommandResponse={{
          id: 'cmd-1',
          robot_id: 'r-1',
          mission_id: null,
          requested_by: 'u-1',
          command_type: 'set_goal',
          status: 'rejected',
          request_payload: {},
          response_payload: null,
          rejection_reason: 'Target coordinate is out of allowable workspace boundary',
          failure_reason: null,
          requested_at: '2026-09-04T12:00:00Z',
          acknowledged_at: null,
          executed_at: null,
          created_at: '2026-09-04T12:00:00Z',
          updated_at: '2026-09-04T12:00:00Z',
        }}
      />,
    );

    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.getByTestId('command-reason-banner')).toHaveTextContent(
      'Target coordinate is out of allowable workspace boundary',
    );
  });
});
