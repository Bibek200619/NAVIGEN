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

  describe('Safety Gating', () => {
    it('healthy connected robot → goal enabled, E-stop enabled, no safety banner', () => {
      render(
        <MissionControls
          isGoalDisabled={false}
          isEstopDisabled={false}
          safetyReason={null}
        />,
      );

      const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
      expect(dispatchBtn).not.toBeDisabled();

      const xInput = screen.getByLabelText(/X \(m\)/);
      const yInput = screen.getByLabelText(/Y \(m\)/);
      const zInput = screen.getByLabelText(/Z \(m\)/);
      const frameInput = screen.getByLabelText(/Frame:/);
      expect(xInput).not.toBeDisabled();
      expect(yInput).not.toBeDisabled();
      expect(zInput).not.toBeDisabled();
      expect(frameInput).not.toBeDisabled();

      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).not.toBeDisabled();

      expect(screen.queryByTestId('safety-lockout-banner')).not.toBeInTheDocument();
    });

    it('stale telemetry → goal disabled + correct safety reason', () => {
      render(
        <MissionControls
          isGoalDisabled={true}
          isEstopDisabled={false}
          safetyReason="Motion commands disabled: Telemetry stream is stale."
        />,
      );

      const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
      expect(dispatchBtn).toBeDisabled();

      expect(screen.getByLabelText(/X \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Y \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Z \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Frame:/)).toBeDisabled();

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Telemetry stream is stale.');
    });

    it('disconnected robot → goal disabled + correct reason and E-Stop disabled', () => {
      render(
        <MissionControls
          isGoalDisabled={true}
          isEstopDisabled={true}
          safetyReason="Motion commands disabled: Robot is disconnected."
        />,
      );

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      expect(screen.getByLabelText(/X \(m\)/)).toBeDisabled();

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is disconnected.');

      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).toBeDisabled();
    });

    it('emergency-stop state → goal disabled + correct reason, E-Stop remains enabled', () => {
      render(
        <MissionControls
          isGoalDisabled={true}
          isEstopDisabled={false}
          safetyReason="Motion commands disabled: Robot is in emergency stop."
        />,
      );

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is in emergency stop.');

      expect(screen.getByRole('button', { name: 'Trigger E-Stop' })).not.toBeDisabled();
    });

    it('robot error state → goal disabled + correct reason, E-Stop remains enabled', () => {
      render(
        <MissionControls
          isGoalDisabled={true}
          isEstopDisabled={false}
          safetyReason="Motion commands disabled: Robot is reporting an error."
        />,
      );

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is reporting an error.');

      expect(screen.getByRole('button', { name: 'Trigger E-Stop' })).not.toBeDisabled();
    });

    it('stale telemetry while connected → Software E-Stop remains enabled/triggerable', () => {
      const onSoftwareEstop = vi.fn();
      const onSetGoal = vi.fn();

      render(
        <MissionControls
          isGoalDisabled={true}
          isEstopDisabled={false}
          safetyReason="Motion commands disabled: Telemetry stream is stale."
          onSoftwareEstop={onSoftwareEstop}
          onSetGoal={onSetGoal}
        />,
      );

      // Goal submission is guarded
      const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
      expect(dispatchBtn).toBeDisabled();
      fireEvent.click(dispatchBtn);
      expect(onSetGoal).not.toHaveBeenCalled();

      // E-Stop is enabled and triggerable
      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).not.toBeDisabled();
      fireEvent.click(estopBtn);

      expect(screen.getByText('Confirm: Trigger emergency software stop?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Stop' }));

      expect(onSoftwareEstop).toHaveBeenCalledTimes(1);
    });

    it('disconnected transport → E-Stop is unavailable/disabled according to existing behavior', () => {
      const onSoftwareEstop = vi.fn();

      render(
        <MissionControls
          isGoalDisabled={true}
          isEstopDisabled={true}
          safetyReason="Motion commands disabled: Robot is disconnected."
          onSoftwareEstop={onSoftwareEstop}
        />,
      );

      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).toBeDisabled();

      fireEvent.click(estopBtn);
      expect(screen.queryByText('Confirm: Trigger emergency software stop?')).not.toBeInTheDocument();
      expect(onSoftwareEstop).not.toHaveBeenCalled();
    });
  });

  describe('Mission Context Badges & Historical Lockout', () => {
    it('renders "Active Mission" badge when hasActiveMission is true', () => {
      render(<MissionControls hasActiveMission={true} />);
      expect(screen.getByText('Active Mission')).toBeInTheDocument();
    });

    it('renders "Historical (Read-Only)" badge when isHistoricalMission is true', () => {
      render(<MissionControls isHistoricalMission={true} />);
      expect(screen.getByText('Historical (Read-Only)')).toBeInTheDocument();
    });

    it('renders "Standalone / Ad-hoc" badge when neither active nor historical', () => {
      render(<MissionControls hasActiveMission={false} isHistoricalMission={false} />);
      expect(screen.getByText('Standalone / Ad-hoc')).toBeInTheDocument();
    });

    it('read-only historical mission: goal inputs & dispatch disabled with banner, while E-Stop remains enabled', () => {
      const onSetGoal = vi.fn();
      const onSoftwareEstop = vi.fn();
      const readOnlyReason =
        'This mission is completed and is read-only. Create or select an active mission to dispatch a new goal.';

      render(
        <MissionControls
          isHistoricalMission={true}
          isGoalDisabled={true}
          isEstopDisabled={false}
          safetyReason={readOnlyReason}
          onSetGoal={onSetGoal}
          onSoftwareEstop={onSoftwareEstop}
        />,
      );

      expect(screen.getByText('Historical (Read-Only)')).toBeInTheDocument();
      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent(readOnlyReason);

      const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
      expect(dispatchBtn).toBeDisabled();
      fireEvent.click(dispatchBtn);
      expect(onSetGoal).not.toHaveBeenCalled();

      expect(screen.getByLabelText(/X \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Y \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Z \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Frame:/)).toBeDisabled();

      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).not.toBeDisabled();
      fireEvent.click(estopBtn);
      expect(screen.getByText('Confirm: Trigger emergency software stop?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Stop' }));
      expect(onSoftwareEstop).toHaveBeenCalledTimes(1);
    });
  });
});
