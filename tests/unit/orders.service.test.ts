import { describe, it, expect, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Import OdooClient type to trigger the FastifyInstance.odoo augmentation
import '../../src/shared/odoo/odoo-client';
import { listOrders, getOrder } from '../../src/modules/orders/orders.service';

// ----------------------------------------------------------------
// Helper — minimal mock fastify with a configurable odoo.searchRead
// ----------------------------------------------------------------

function makeApp(searchReadReturnValue: unknown[]): FastifyInstance {
  return {
    odoo: {
      searchRead: vi.fn().mockResolvedValue(searchReadReturnValue),
    },
  } as unknown as FastifyInstance;
}

/** Typed helper to access the spy on app.odoo.searchRead. */
function getSearchReadSpy(app: FastifyInstance): ReturnType<typeof vi.fn> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (app as any).odoo.searchRead as ReturnType<typeof vi.fn>;
}

// A realistic Odoo order record
const baseRecord = {
  id: 1,
  name: 'KLA/2026/00001',
  state: 'draft',
  amount_total: 3000,
  currency_id: [1, 'XAF'],
  total_pieces: 2,
  date_received: false,
  date_ready: false,
};

// ----------------------------------------------------------------
// listOrders — status mapping
// ----------------------------------------------------------------

describe('listOrders — Odoo state → API status mapping', () => {
  const statusCases: Array<{ odooState: string; apiStatus: string }> = [
    { odooState: 'draft',      apiStatus: 'pending' },
    { odooState: 'received',   apiStatus: 'received' },
    { odooState: 'in_progress', apiStatus: 'processing' },
    { odooState: 'ready',      apiStatus: 'ready_for_pickup' },
    { odooState: 'delivered',  apiStatus: 'delivered' },
    { odooState: 'cancelled',  apiStatus: 'cancelled' },
  ];

  for (const { odooState, apiStatus } of statusCases) {
    it(`maps "${odooState}" → "${apiStatus}"`, async () => {
      const app = makeApp([{ ...baseRecord, state: odooState }]);
      const [order] = await listOrders(app, 42, {});
      expect(order.status).toBe(apiStatus);
    });
  }
});

// ----------------------------------------------------------------
// listOrders — domain filtering (partner isolation)
// ----------------------------------------------------------------

describe('listOrders — domain construction', () => {
  it('always includes partner_id filter in the Odoo domain', async () => {
    const app = makeApp([]);
    await listOrders(app, 99, {});

    const [model, domain] = getSearchReadSpy(app).mock.calls[0];
    expect(model).toBe('laundry.order');
    expect(domain).toContainEqual(['partner_id', '=', 99]);
  });

  it('adds state filter when ?status query param is provided', async () => {
    const app = makeApp([]);
    await listOrders(app, 42, { status: 'pending' });

    const [, domain] = (app.odoo.searchRead as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(domain).toContainEqual(['state', '=', 'draft']);
  });

  it('maps "processing" status param to "in_progress" Odoo state', async () => {
    const app = makeApp([]);
    await listOrders(app, 42, { status: 'processing' });

    const [, domain] = (app.odoo.searchRead as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(domain).toContainEqual(['state', '=', 'in_progress']);
  });
});

// ----------------------------------------------------------------
// listOrders — field mapping
// ----------------------------------------------------------------

describe('listOrders — field mapping', () => {
  it('extracts currency name from Many2one tuple', async () => {
    const app = makeApp([{ ...baseRecord, currency_id: [3, 'EUR'] }]);
    const [order] = await listOrders(app, 42, {});
    expect(order.currency).toBe('EUR');
  });

  it('defaults currency to "XAF" when currency_id is false', async () => {
    const app = makeApp([{ ...baseRecord, currency_id: false }]);
    const [order] = await listOrders(app, 42, {});
    expect(order.currency).toBe('XAF');
  });

  it('converts Odoo datetime string to ISO 8601 with UTC Z suffix', async () => {
    const app = makeApp([{ ...baseRecord, date_received: '2026-03-30 10:00:00' }]);
    const [order] = await listOrders(app, 42, {});
    expect(order.date_received).toBe('2026-03-30T10:00:00.000Z');
  });

  it('returns undefined for unset datetime fields (Odoo false)', async () => {
    const app = makeApp([{ ...baseRecord, date_received: false }]);
    const [order] = await listOrders(app, 42, {});
    expect(order.date_received).toBeUndefined();
  });
});

// ----------------------------------------------------------------
// getOrder — partner isolation
// ----------------------------------------------------------------

describe('getOrder — partner isolation', () => {
  it('returns null when searchRead returns empty (order not found or wrong partner)', async () => {
    const app = makeApp([]); // searchRead returns [] → partner mismatch or not found
    const result = await getOrder(app, 1, 99);
    expect(result).toBeNull();
  });

  it('passes both id and partner_id in the Odoo domain', async () => {
    const app = makeApp([]);
    await getOrder(app, 5, 42);

    const [, domain] = (app.odoo.searchRead as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(domain).toContainEqual(['id', '=', 5]);
    expect(domain).toContainEqual(['partner_id', '=', 42]);
  });
});
