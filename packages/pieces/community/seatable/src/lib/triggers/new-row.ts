import { TriggerStrategy, createTrigger } from '@activepieces/pieces-framework';
import { seatableAuth, seatableConnection } from '../auth';
import { newRowPolling } from '../common/polling';
import { seatableProps } from '../common/props';

export const newRowTrigger = createTrigger({
  auth: seatableAuth,
  name: 'new_row',
  classification: 'READ',
  displayName: 'New Row',
  description: 'Triggers when a new row is added to a table.',
  aiMetadata: {
    description:
      'Fires once for each row added to the chosen SeaTable table, with every cell keyed by column name. Polling-based, so a row arrives on the next poll, not instantly; edits to existing rows do not fire it.',
  },
  type: TriggerStrategy.POLLING,
  props: {
    table: seatableProps.table(),
  },
  sampleData: {
    _id: 'Qtf7xPmoRaiFyQPO1aENTj',
    _ctime: '2026-11-20T16:21:11.723+01:00',
    _mtime: '2026-11-20T16:21:11.723+01:00',
    _creator: 'activepieces',
    _last_modifier: 'activepieces',
    Name: 'Ada Lovelace',
    Email: 'ada@example.com',
    Status: 'Lead',
    Active: true,
  },
  async onEnable(context) {
    await newRowPolling.onEnable({
      auth: seatableConnection.toProps(context.auth),
      table: context.propsValue.table,
      store: context.store,
      isRepublish: context.isRepublish,
    });
  },
  async onDisable() {
    return;
  },
  async run(context) {
    return newRowPolling.poll({
      auth: seatableConnection.toProps(context.auth),
      table: context.propsValue.table,
      store: context.store,
    });
  },
  async test(context) {
    return newRowPolling.test({ auth: seatableConnection.toProps(context.auth), table: context.propsValue.table });
  },
});
