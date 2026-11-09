// Room occupancy as OpenTelemetry gauges: the crowd map in Dash0 is built
// from these, the same numbers the live map shows.
import { metrics } from '@opentelemetry/api';
import { simulator } from './simulator';
import { ROOM_BY_ID } from '../shared/venue';

const meter = metrics.getMeter('capykube');

export function registerGauges() {
  const present = meter.createObservableGauge('capykube.room.present', {
    description: 'People in each room right now',
    unit: '{person}',
  });
  const capacity = meter.createObservableGauge('capykube.room.capacity', {
    description: 'Seats in each room',
    unit: '{seat}',
  });
  const held = meter.createObservableGauge('capykube.room.held', {
    description: 'Seats held for people on their way from a Plan B',
    unit: '{seat}',
  });
  const utilization = meter.createObservableGauge('capykube.room.utilization', {
    description: 'Share of seats taken or held, 0 to 1',
    unit: '1',
  });
  const moving = meter.createObservableGauge('capykube.crowd.people', {
    description: 'People walking between rooms or waiting at a full door',
    unit: '{person}',
  });

  meter.addBatchObservableCallback(
    (result) => {
      for (const r of simulator.rooms()) {
        const room = ROOM_BY_ID.get(r.id);
        if (!room || room.kind !== 'session') continue;
        const attrs = { 'capykube.room.id': r.id, 'capykube.room.level': room.level, 'capykube.room.track': room.track };
        result.observe(present, r.present, attrs);
        result.observe(capacity, r.capacity, attrs);
        result.observe(held, r.held, attrs);
        result.observe(utilization, (r.present + r.held) / r.capacity, attrs);
      }
      const { walking, waiting } = simulator.counts();
      result.observe(moving, walking, { 'capykube.crowd.state': 'walking' });
      result.observe(moving, waiting, { 'capykube.crowd.state': 'waiting' });
    },
    [present, capacity, held, utilization, moving],
  );
}
