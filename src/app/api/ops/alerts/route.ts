import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { opsError } from '../_guard';

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession('payment:view');
    const store = await getStore();

    const [alerts, areas] = await Promise.all([
      loadRedAlerts(store, session.scope.areaIds),
      store.areas.find(),
    ]);

    const areaById = new Map(areas.map((a) => [a.id, a]));
    const { searchParams } = new URL(request.url);

    const query = (searchParams.get('q') ?? '').trim().toLowerCase();
    const severity = searchParams.get('severity'); // 'OVER14' | 'UNDER14' | 'HOLD'
    const areaId = searchParams.get('area');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

    // Summary statistics across all scoped alerts
    const totalAmount = alerts.reduce((sum, a) => sum + a.amount, 0);
    const severeCount = alerts.filter((a) => a.daysOverdue > 14).length;
    const longestOverdueDays = alerts.length > 0 ? alerts[0].daysOverdue : 0;

    // Apply filtering
    const filtered = alerts.filter((item) => {
      if (areaId && item.customer.areaId !== areaId) return false;

      if (severity) {
        if (severity === 'OVER14' && item.daysOverdue <= 14) return false;
        if (severity === 'UNDER14' && item.daysOverdue > 14) return false;
        if (severity === 'HOLD' && item.customer.status !== 'HOLD') return false;
      }

      if (query) {
        const areaName = areaById.get(item.customer.areaId)?.name ?? '';
        const haystack = [
          item.customer.name,
          item.customer.phone,
          item.customer.altPhone ?? '',
          item.customer.address,
          areaName,
          item.reason,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const paginatedAlerts = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      stats: {
        totalFlagged: alerts.length,
        totalAmount,
        severeCount,
        longestOverdueDays,
      },
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      alerts: paginatedAlerts,
    });
  } catch (error) {
    return opsError(error);
  }
}
