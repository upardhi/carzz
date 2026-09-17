'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import type { Area, InventoryItem, PurchaseRequest, Staff, StockRow } from '@/lib/data/types';
import { money, todayISO } from '@/lib/util/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDebounce } from '@/lib/util/debounce';

interface AreaStockData {
  area: Area;
  rows: StockRow[];
}

interface InventoryClientProps {
  stockByArea: AreaStockData[];
  items: InventoryItem[];
  areas: Area[];
  staff: Staff[];
  requests: PurchaseRequest[];
  canApprovePurchase?: boolean;
}

export function InventoryClient({
  stockByArea,
  items,
  areas,
  staff,
  requests: _requests,
  canApprovePurchase,
}: InventoryClientProps) {
  const router = useRouter();

  // Top Tab State: Stock by Area vs Master Catalog
  const [activeTab, setActiveTab] = useState<'STOCK' | 'CATALOG'>('STOCK');

  // Filter States
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'LOW' | 'OUT'>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);

  const checkHasActiveRequest = useCallback((areaId: string, itemId: string) => {
    return _requests.some(
      (r) =>
        r.itemId === itemId &&
        r.areaId === areaId &&
        (r.status === 'PENDING' || r.status === 'APPROVED')
    );
  }, [_requests]);

  // Modal / Action States
  const [reorderModal, setReorderModal] = useState<{
    open: boolean;
    areaId: string;
    itemId?: string;
    itemName?: string;
    unit?: string;
    isCustom?: boolean;
  } | null>(null);

  const [issueModal, setIssueModal] = useState<{
    open: boolean;
    areaId: string;
    itemId: string;
    itemName: string;
    unit: string;
  } | null>(null);

  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    row: StockRow;
    areaName: string;
  } | null>(null);

  const [addItemModal, setAddItemModal] = useState(false);
  const [editItemModal, setEditItemModal] = useState<InventoryItem | null>(null);

  const [modalPending, setModalPending] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ ok?: string; error?: string } | null>(null);

  // Form inputs for reorder
  const [reorderAreaId, setReorderAreaId] = useState(areas[0]?.id ?? '');
  const [reorderItemId, setReorderItemId] = useState(items[0]?.id ?? '');
  const [reorderIsCustom, setReorderIsCustom] = useState(false);
  const [reorderCustomName, setReorderCustomName] = useState('');
  const [reorderCustomUnit, setReorderCustomUnit] = useState('Pieces');
  const [reorderCustomCost, setReorderCustomCost] = useState('150');
  const [reorderQty, setReorderQty] = useState('40');
  const [reorderNeededBy, setReorderNeededBy] = useState('');
  const [reorderReason, setReorderReason] = useState('');

  // Form inputs for issue
  const [issueQty, setIssueQty] = useState('1');
  const [issueStaffId, setIssueStaffId] = useState('');

  // Form inputs for add item
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('Litres');
  const [newItemUnitCost, setNewItemUnitCost] = useState('200');
  const [newItemReorderLevel, setNewItemReorderLevel] = useState('10');
  const [newItemUsagePerWash, setNewItemUsagePerWash] = useState('0.05');

  // Form inputs for edit item
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editUnitCost, setEditUnitCost] = useState('0');
  const [editReorderLevel, setEditReorderLevel] = useState('0');
  const [editUsagePerWash, setEditUsagePerWash] = useState('0');
  const [editActive, setEditActive] = useState(true);

  // Extract all item rows with their area info
  const allFlattenedRows = useMemo(() => {
    return stockByArea.flatMap((s) =>
      s.rows.map((r) => ({
        ...r,
        areaId: s.area.id,
        areaName: s.area.name,
      })),
    );
  }, [stockByArea]);

  // Total stock per item across all areas
  const totalStockByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allFlattenedRows) {
      map.set(r.item.id, (map.get(r.item.id) ?? 0) + r.quantity);
    }
    return map;
  }, [allFlattenedRows]);

  // Items needing attention (OUT or LOW or CRITICAL)
  const itemsNeedingAttention = useMemo(() => {
    return allFlattenedRows.filter((r) => r.status === 'OUT' || r.status === 'LOW' || r.status === 'CRITICAL');
  }, [allFlattenedRows]);

  // Counts for top status pills
  const counts = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;
    for (const r of allFlattenedRows) {
      if (r.status === 'OUT') out++;
      else if (r.status === 'LOW' || r.status === 'CRITICAL') low++;
      else ok++;
    }
    return {
      all: allFlattenedRows.length,
      ok,
      low,
      out,
    };
  }, [allFlattenedRows]);

  // Filtered Area Stock Groups
  const filteredStockByArea = useMemo(() => {
    return stockByArea
      .filter((s) => areaFilter === 'ALL' || s.area.id === areaFilter)
      .map((s) => {
        const filteredRows = s.rows.filter((r) => {
          // Status Filter
          if (statusFilter === 'OK' && r.status !== 'OK') return false;
          if (statusFilter === 'LOW' && (r.status !== 'LOW' && r.status !== 'CRITICAL')) return false;
          if (statusFilter === 'OUT' && r.status !== 'OUT') return false;

          // Search Filter
          if (debouncedSearch.trim()) {
            const q = debouncedSearch.toLowerCase();
            const matchName = r.item.name.toLowerCase().includes(q);
            const matchArea = s.area.name.toLowerCase().includes(q);
            if (!matchName && !matchArea) return false;
          }

          return true;
        });

        const areaStockValue = s.rows.reduce((sum, r) => sum + r.value, 0);
        const lowCount = s.rows.filter((r) => r.status === 'LOW' || r.status === 'CRITICAL').length;
        const outCount = s.rows.filter((r) => r.status === 'OUT').length;

        let areaHealth: 'HEALTHY' | 'ATTENTION' | 'ACTION' = 'HEALTHY';
        if (outCount > 0) areaHealth = 'ACTION';
        else if (lowCount > 0) areaHealth = 'ATTENTION';

        return {
          area: s.area,
          rows: filteredRows,
          allRowsCount: s.rows.length,
          stockValue: areaStockValue,
          lowCount,
          outCount,
          health: areaHealth,
        };
      })
      .filter((s) => s.rows.length > 0 || statusFilter === 'ALL');
  }, [stockByArea, areaFilter, statusFilter, debouncedSearch]);

  // Filtered Catalog Items
  const filteredCatalogItems = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q));
  }, [items, debouncedSearch]);

  const unresolvedAttentionItems = useMemo(() => {
    return itemsNeedingAttention.filter(
      (r) => !checkHasActiveRequest(r.areaId, r.item.id)
    );
  }, [itemsNeedingAttention, checkHasActiveRequest]);

  // First urgent item for top alert (only from unresolved items)
  const primaryUrgent = unresolvedAttentionItems[0];

  function openNewRequestModal(targetAreaId?: string, targetItemId?: string) {
    const area = targetAreaId || areas[0]?.id || '';
    const item = targetItemId ? items.find((i) => i.id === targetItemId) : items[0];
    setReorderAreaId(area);
    if (targetItemId && item) {
      setReorderItemId(item.id);
      setReorderIsCustom(false);
      setReorderQty(String(item.reorderLevel * 2 || 40));
      setReorderModal({
        open: true,
        areaId: area,
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        isCustom: false,
      });
    } else {
      setReorderItemId(items[0]?.id ?? '');
      setReorderIsCustom(false);
      setReorderQty('40');
      setReorderModal({
        open: true,
        areaId: area,
        itemId: items[0]?.id,
        itemName: items[0]?.name,
        unit: items[0]?.unit,
        isCustom: false,
      });
    }
    setReorderNeededBy(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    setReorderReason('');
    setModalFeedback(null);
  }

  function openEditItemModal(item: InventoryItem) {
    setEditItemModal(item);
    setEditName(item.name);
    setEditUnit(item.unit);
    setEditUnitCost(String(item.unitCost));
    setEditReorderLevel(String(item.reorderLevel));
    setEditUsagePerWash(String(item.usagePerWash));
    setEditActive(item.active);
    setModalFeedback(null);
  }

  // Handlers for API actions
  async function submitReorder() {
    if (!reorderModal) return;
    setModalPending(true);
    setModalFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        action: 'request',
        areaId: reorderAreaId,
        quantity: Number(reorderQty),
        neededBy: reorderNeededBy,
        reason: reorderReason || undefined,
      };

      if (reorderIsCustom) {
        payload.isCustom = true;
        payload.customItemName = reorderCustomName;
        payload.customUnit = reorderCustomUnit;
        payload.customUnitCost = Number(reorderCustomCost) || 100;
      } else {
        payload.itemId = reorderItemId;
      }

      const res = await fetch('/api/ops/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalFeedback({ error: data.error ?? 'Failed to submit request.' });
        return;
      }
      setModalFeedback({ ok: data.message ?? 'Purchase request submitted.' });
      setTimeout(() => {
        setReorderModal(null);
        router.refresh();
      }, 1000);
    } catch {
      setModalFeedback({ error: 'Connection error. Please try again.' });
    } finally {
      setModalPending(false);
    }
  }

  async function submitAddItem() {
    if (!newItemName.trim() || !newItemUnit.trim()) {
      setModalFeedback({ error: 'Please enter item name and unit.' });
      return;
    }
    setModalPending(true);
    setModalFeedback(null);
    try {
      const res = await fetch('/api/ops/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addItem',
          name: newItemName.trim(),
          unit: newItemUnit.trim(),
          unitCost: Number(newItemUnitCost) || 0,
          reorderLevel: Number(newItemReorderLevel) || 10,
          usagePerWash: Number(newItemUsagePerWash) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalFeedback({ error: data.error ?? 'Failed to add item.' });
        return;
      }
      setModalFeedback({ ok: data.message ?? 'Item added successfully.' });
      setTimeout(() => {
        setAddItemModal(false);
        setNewItemName('');
        router.refresh();
      }, 1000);
    } catch {
      setModalFeedback({ error: 'Connection error. Please try again.' });
    } finally {
      setModalPending(false);
    }
  }

  async function submitEditItem() {
    if (!editItemModal || !editName.trim() || !editUnit.trim()) {
      setModalFeedback({ error: 'Please enter item name and unit.' });
      return;
    }
    setModalPending(true);
    setModalFeedback(null);
    try {
      const res = await fetch('/api/ops/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateItem',
          itemId: editItemModal.id,
          name: editName.trim(),
          unit: editUnit.trim(),
          unitCost: Number(editUnitCost) || 0,
          reorderLevel: Number(editReorderLevel) || 0,
          usagePerWash: Number(editUsagePerWash) || 0,
          active: editActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalFeedback({ error: data.error ?? 'Failed to update item.' });
        return;
      }
      setModalFeedback({ ok: data.message ?? 'Item updated successfully.' });
      setTimeout(() => {
        setEditItemModal(null);
        router.refresh();
      }, 1000);
    } catch {
      setModalFeedback({ error: 'Connection error. Please try again.' });
    } finally {
      setModalPending(false);
    }
  }

  async function submitIssue() {
    if (!issueModal || !issueStaffId) return;
    setModalPending(true);
    setModalFeedback(null);
    try {
      const res = await fetch('/api/ops/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'issue',
          areaId: issueModal.areaId,
          itemId: issueModal.itemId,
          staffId: issueStaffId,
          quantity: Number(issueQty),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalFeedback({ error: data.error ?? 'Failed to issue stock.' });
        return;
      }
      setModalFeedback({ ok: data.message ?? 'Stock issued successfully.' });
      setTimeout(() => {
        setIssueModal(null);
        router.refresh();
      }, 1000);
    } catch {
      setModalFeedback({ error: 'Connection error. Please try again.' });
    } finally {
      setModalPending(false);
    }
  }

  return (
    <div className="space-y-5" suppressHydrationWarning>
      {/* ========================================================================= */}
      {/* 1. TOP ALERT BANNER (if items need attention)                             */}
      {/* ========================================================================= */}
      {unresolvedAttentionItems.length > 0 && primaryUrgent && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50/90 px-5 py-4 shadow-sm" suppressHydrationWarning>
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-lg shadow-sm">
              !
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900 leading-snug">
                {unresolvedAttentionItems.length} item{unresolvedAttentionItems.length === 1 ? '' : 's'} needs attention
              </h4>
              <p className="text-xs font-medium text-rose-700/90 mt-0.5">
                {primaryUrgent.item.name} at {primaryUrgent.areaName} is {primaryUrgent.status === 'OUT' ? 'out of stock' : 'running low'} and should be reordered.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('STOCK');
              setStatusFilter('OUT');
              window.scrollTo({ top: 350, behavior: 'smooth' });
            }}
            className="whitespace-nowrap shrink-0 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-900 shadow-sm hover:bg-rose-100/50 active:scale-95 transition-all"
          >
            View affected items →
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TOP ACTION & TAB SWITCHER BAR                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3" suppressHydrationWarning>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('STOCK')}
            className={clsx(
              'px-4 py-2 text-xs font-bold rounded-xl transition-all',
              activeTab === 'STOCK'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
            )}
          >
            📦 Stock by Area
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CATALOG')}
            className={clsx(
              'px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5',
              activeTab === 'CATALOG'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
            )}
          >
            📋 Master Items Catalog ({items.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openNewRequestModal()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm transition-all"
          >
            <span>✨</span>
            <span>Raise Purchase Request</span>
          </button>

          {(canApprovePurchase || true) && (
            <button
              type="button"
              onClick={() => {
                setModalFeedback(null);
                setAddItemModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#071739] hover:bg-[#0c224f] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all"
            >
              <span>+</span>
              <span>Add New Item</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MASTER ITEMS CATALOG TAB VIEW                                          */}
      {/* ========================================================================= */}
      {activeTab === 'CATALOG' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" suppressHydrationWarning>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Master Items Catalog
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                All inventory items available across the business. Owner and admins can add or modify items here.
              </p>
            </div>

            <div className="relative sm:w-64">
              <input
                type="text"
                placeholder="Search catalog items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none transition-all"
              />
              <svg
                className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/20 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3">ITEM NAME</th>
                  <th className="px-4 py-3">UNIT</th>
                  <th className="px-4 py-3">UNIT COST</th>
                  <th className="px-4 py-3">USAGE / WASH</th>
                  <th className="px-4 py-3">REORDER POINT</th>
                  <th className="px-4 py-3">TOTAL STOCK (ALL AREAS)</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-6 py-3 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredCatalogItems.map((item) => {
                  const total = totalStockByItem.get(item.id) ?? 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {item.unit}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {money(item.unitCost)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {item.usagePerWash > 0 ? `${item.usagePerWash} ${item.unit}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {item.reorderLevel} {item.unit}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {total} {item.unit}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            item.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openNewRequestModal(undefined, item.id)}
                            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 shadow-sm transition-all"
                          >
                            Order
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditItemModal(item)}
                            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. STOCK BY AREA TAB VIEW                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'STOCK' && (
        <>
          {/* ITEMS NEEDING ATTENTION TABLE CARD */}
          {itemsNeedingAttention.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" suppressHydrationWarning>
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
                    Items needing attention
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'OUT' ? 'ALL' : 'OUT')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View all ({itemsNeedingAttention.length}) →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-3">ITEM</th>
                      <th className="px-4 py-3">AREA</th>
                      <th className="px-4 py-3">CURRENT STOCK</th>
                      <th className="px-4 py-3">DAYS LEFT</th>
                      <th className="px-4 py-3">RECOMMENDED</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-6 py-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {itemsNeedingAttention.slice(0, 5).map((row, i) => {
                      const isOut = row.status === 'OUT';
                      const hasActiveRequest = checkHasActiveRequest(row.areaId, row.item.id);
                      return (
                        <tr key={`${row.areaId}-${row.item.id}-${i}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">
                            {row.item.name}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {row.areaName}
                          </td>
                          <td className="px-4 py-3.5 font-bold">
                            <span className={isOut ? 'text-rose-600 font-bold' : 'text-slate-900'}>
                              {row.quantity} {row.item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-bold">
                            <span className={isOut ? 'text-rose-600 font-bold' : 'text-amber-600'}>
                              {row.daysLeft !== null ? `${row.daysLeft.toFixed(1)} days` : '0 days'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500">
                            {row.item.reorderLevel} {row.item.unit}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={clsx(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                                isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
                              )}
                            >
                              {isOut ? 'Out of stock' : 'Low stock'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            {hasActiveRequest ? (
                              <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                Ordered
                              </span>
                            ) : isOut ? (
                              <button
                                type="button"
                                onClick={() => openNewRequestModal(row.areaId, row.item.id)}
                                className="rounded-lg bg-[#071739] hover:bg-[#0c224f] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all"
                              >
                                Reorder now
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDetailsModal({
                                    open: true,
                                    row,
                                    areaName: row.areaName,
                                  });
                                }}
                                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all"
                              >
                                View details
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FILTER BAR (Status pills, Area select, Search) */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2" suppressHydrationWarning>
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                  statusFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                )}
              >
                <span>All items</span>
                <span className={clsx('rounded-full px-1.5 py-0.2 text-[10px] font-bold', statusFilter === 'ALL' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600')}>
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('OK')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                  statusFilter === 'OK'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>OK</span>
                <span className={clsx('rounded-full px-1.5 py-0.2 text-[10px] font-bold', statusFilter === 'OK' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700')}>
                  {counts.ok}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('LOW')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                  statusFilter === 'LOW'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span>Low stock</span>
                <span className={clsx('rounded-full px-1.5 py-0.2 text-[10px] font-bold', statusFilter === 'LOW' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700')}>
                  {counts.low}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('OUT')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all',
                  statusFilter === 'OUT'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Out of stock</span>
                <span className={clsx('rounded-full px-1.5 py-0.2 text-[10px] font-bold', statusFilter === 'OUT' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700')}>
                  {counts.out}
                </span>
              </button>
            </div>

            {/* Right Selectors & Search */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Area Select */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="text-slate-400 font-bold">Area:</span>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All areas</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 sm:w-56">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
                <svg
                  className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>
          </div>

          {/* GROUPED AREA INVENTORY CARDS */}
          <div className="space-y-5" suppressHydrationWarning>
            {filteredStockByArea.map((group) => (
              <div key={group.area.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" suppressHydrationWarning>
                {/* Area Header Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40 px-6 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 text-sm">📍</span>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        {group.area.name}
                      </h3>
                    </div>

                    {/* Health Badge */}
                    {group.health === 'HEALTHY' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                        🛡️ Healthy
                      </span>
                    )}
                    {group.health === 'ATTENTION' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
                        ⚠️ Attention
                      </span>
                    )}
                    {group.health === 'ACTION' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10.5px] font-semibold text-rose-700">
                        🔴 Needs action
                      </span>
                    )}

                    {/* Meta details */}
                    <span className="text-xs font-medium text-slate-500">
                      {group.allRowsCount} items · {money(group.stockValue)} stock value
                      {group.lowCount > 0 ? ` · ${group.lowCount} low stock` : ''}
                      {group.outCount > 0 ? ` · ${group.outCount} out of stock` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => openNewRequestModal(group.area.id)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      + Request for this area
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAreaFilter(areaFilter === group.area.id ? 'ALL' : group.area.id)}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {areaFilter === group.area.id ? 'Show all' : 'Focus'}
                    </button>
                  </div>
                </div>

                {/* Table inside Area Card */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/20 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-6 py-3">ITEM</th>
                        <th className="px-4 py-3">STOCK</th>
                        <th className="px-4 py-3">DAILY USE</th>
                        <th className="px-4 py-3">DAYS LEFT</th>
                        <th className="px-4 py-3">REORDER AT</th>
                        <th className="px-4 py-3">STATUS</th>
                        <th className="px-6 py-3 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {group.rows.map((row) => {
                        const isOut = row.status === 'OUT';
                        const isLow = row.status === 'LOW' || row.status === 'CRITICAL';
                        const hasActiveRequest = checkHasActiveRequest(group.area.id, row.item.id);
                        return (
                          <tr key={row.item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-slate-900">
                              {row.item.name}
                            </td>
                            <td className="px-4 py-3.5 font-bold">
                              <span className={isOut ? 'text-rose-600 font-bold' : isLow ? 'text-amber-700 font-bold' : 'text-slate-900'}>
                                {row.quantity} {row.item.unit}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">
                              {row.usagePerDay > 0 ? `${row.usagePerDay.toFixed(2)} ${row.item.unit}` : '0.00'}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={isOut ? 'text-rose-600 font-bold' : isLow ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                                {row.daysLeft !== null ? row.daysLeft.toFixed(1) : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">
                              {row.item.reorderLevel} {row.item.unit}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={clsx(
                                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                                  isOut
                                    ? 'bg-rose-100 text-rose-700'
                                    : isLow
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800',
                                )}
                              >
                                {isOut ? 'Out' : isLow ? 'Low' : 'OK'}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIssueStaffId(staff.find((s) => s.areaId === group.area.id)?.id ?? '');
                                    setIssueModal({
                                      open: true,
                                      areaId: group.area.id,
                                      itemId: row.item.id,
                                      itemName: row.item.name,
                                      unit: row.item.unit,
                                    });
                                  }}
                                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition-all"
                                >
                                  Issue
                                </button>
                                {hasActiveRequest ? (
                                  <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                    Ordered
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openNewRequestModal(group.area.id, row.item.id)}
                                    className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 shadow-sm transition-all"
                                  >
                                    Order
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* REORDER / PURCHASE REQUEST MODAL (Supports Catalog + Custom Items)        */}
      {/* ========================================================================= */}
      {reorderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150" suppressHydrationWarning>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Raise purchase request
              </h3>
              <button
                type="button"
                onClick={() => setReorderModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              {/* Area Selection */}
              <div>
                <label className="block mb-1 text-slate-600">Target Area</label>
                <select
                  value={reorderAreaId}
                  onChange={(e) => setReorderAreaId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Selection Mode */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600">Item</label>
                  <button
                    type="button"
                    onClick={() => {
                      setReorderIsCustom(!reorderIsCustom);
                    }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {reorderIsCustom ? '← Pick existing item' : '✨ Request custom / new item'}
                  </button>
                </div>

                {!reorderIsCustom ? (
                  <select
                    value={reorderItemId}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setReorderIsCustom(true);
                      } else {
                        setReorderItemId(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit}) — {money(i.unitCost)}
                      </option>
                    ))}
                    <option value="__custom__">✨ + Request custom item (not in list)...</option>
                  </select>
                ) : (
                  <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                    <div>
                      <label className="block mb-1 text-slate-700 font-bold">Custom item name</label>
                      <input
                        type="text"
                        placeholder="e.g. Foam Cannon Pressure Nozzle"
                        value={reorderCustomName}
                        onChange={(e) => setReorderCustomName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 text-slate-700">Unit</label>
                        <input
                          type="text"
                          placeholder="e.g. Pieces, Litres"
                          value={reorderCustomUnit}
                          onChange={(e) => setReorderCustomUnit(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-slate-700">Est. cost / unit (₹)</label>
                        <input
                          type="number"
                          placeholder="₹"
                          value={reorderCustomCost}
                          onChange={(e) => setReorderCustomCost(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block mb-1 text-slate-600">
                  Quantity ({reorderIsCustom ? reorderCustomUnit : items.find((i) => i.id === reorderItemId)?.unit || 'Units'})
                </label>
                <input
                  type="number"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Needed By */}
              <div>
                <label className="block mb-1 text-slate-600">Needed by</label>
                <input
                  type="date"
                  min={todayISO()}
                  value={reorderNeededBy}
                  onChange={(e) => setReorderNeededBy(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block mb-1 text-slate-600">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={reorderReason}
                  onChange={(e) => setReorderReason(e.target.value)}
                  placeholder="Why is this item needed..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {modalFeedback?.error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {modalFeedback.error}
              </p>
            )}
            {modalFeedback?.ok && (
              <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-lg">
                {modalFeedback.ok}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReorderModal(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalPending || !Number(reorderQty) || (reorderIsCustom && !reorderCustomName.trim())}
                onClick={submitReorder}
                className="flex-1 rounded-xl bg-[#071739] hover:bg-[#0c224f] text-white py-2.5 text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {modalPending ? 'Sending…' : 'Send to owner for approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD NEW ITEM TO CATALOG MODAL                                             */}
      {/* ========================================================================= */}
      {addItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150" suppressHydrationWarning>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Add new item to master catalog
              </h3>
              <button
                type="button"
                onClick={() => setAddItemModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Once added, this item will be available for all areas to track stock, record usage, and order.
            </p>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Foam Shampoo Concentrated"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Unit of Measurement</label>
                  <input
                    type="text"
                    placeholder="e.g. Litres, Bottles, Pcs"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Unit Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="₹"
                    value={newItemUnitCost}
                    onChange={(e) => setNewItemUnitCost(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Tooltip
                    position="top"
                    content="Minimum stock threshold. System flags 'Low Stock' when quantity falls below this."
                  >
                    <label className="block mb-1 text-slate-600 border-b border-dashed border-slate-300 cursor-help w-max pb-0.5">
                      Reorder Level
                    </label>
                  </Tooltip>
                  <input
                    type="number"
                    placeholder="10"
                    value={newItemReorderLevel}
                    onChange={(e) => setNewItemReorderLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <Tooltip
                    position="top"
                    content="Estimated quantity consumed during one car wash."
                  >
                    <label className="block mb-1 text-slate-600 border-b border-dashed border-slate-300 cursor-help w-max pb-0.5">
                      Usage per Wash ({newItemUnit || 'Units'})
                    </label>
                  </Tooltip>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.05"
                    value={newItemUsagePerWash}
                    onChange={(e) => setNewItemUsagePerWash(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {modalFeedback?.error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {modalFeedback.error}
              </p>
            )}
            {modalFeedback?.ok && (
              <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-lg">
                {modalFeedback.ok}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddItemModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalPending || !newItemName.trim() || !newItemUnit.trim()}
                onClick={submitAddItem}
                className="flex-1 rounded-xl bg-[#071739] hover:bg-[#0c224f] text-white py-2.5 text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {modalPending ? 'Adding…' : 'Add to catalog'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT ITEM IN CATALOG MODAL                                                */}
      {/* ========================================================================= */}
      {editItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150" suppressHydrationWarning>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit catalog item
              </h3>
              <button
                type="button"
                onClick={() => setEditItemModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Item Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-600">Unit</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Unit Cost (₹)</label>
                  <input
                    type="number"
                    value={editUnitCost}
                    onChange={(e) => setEditUnitCost(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Tooltip
                    position="top"
                    content="Minimum stock threshold. System flags 'Low Stock' when quantity falls below this."
                  >
                    <label className="block mb-1 text-slate-600 border-b border-dashed border-slate-300 cursor-help w-max pb-0.5">
                      Reorder Level
                    </label>
                  </Tooltip>
                  <input
                    type="number"
                    value={editReorderLevel}
                    onChange={(e) => setEditReorderLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <Tooltip
                    position="top"
                    content="Estimated quantity consumed during one car wash."
                  >
                    <label className="block mb-1 text-slate-600 border-b border-dashed border-slate-300 cursor-help w-max pb-0.5">
                      Usage per Wash ({editUnit})
                    </label>
                  </Tooltip>
                  <input
                    type="number"
                    step="0.01"
                    value={editUsagePerWash}
                    onChange={(e) => setEditUsagePerWash(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="edit-active" className="text-slate-700 cursor-pointer font-bold">
                  Active (available for areas to use and request)
                </label>
              </div>
            </div>

            {modalFeedback?.error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {modalFeedback.error}
              </p>
            )}
            {modalFeedback?.ok && (
              <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-lg">
                {modalFeedback.ok}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditItemModal(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalPending || !editName.trim() || !editUnit.trim()}
                onClick={submitEditItem}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {modalPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ISSUE STOCK MODAL                                                         */}
      {/* ========================================================================= */}
      {issueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150" suppressHydrationWarning>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Issue goods to wash staff
              </h3>
              <button
                type="button"
                onClick={() => setIssueModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Issuing <b>{issueModal.itemName}</b> in <b>{areas.find((a) => a.id === issueModal.areaId)?.name}</b>.
            </p>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Select wash boy</label>
                <select
                  value={issueStaffId}
                  onChange={(e) => setIssueStaffId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select staff member...</option>
                  {staff
                    .filter((s) => s.areaId === issueModal.areaId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-slate-600">Quantity ({issueModal.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {modalFeedback?.error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {modalFeedback.error}
              </p>
            )}
            {modalFeedback?.ok && (
              <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-lg">
                {modalFeedback.ok}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIssueModal(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalPending || !issueStaffId || !Number(issueQty)}
                onClick={submitIssue}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {modalPending ? 'Recording…' : 'Record issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW DETAILS MODAL                                                        */}
      {/* ========================================================================= */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150" suppressHydrationWarning>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {detailsModal.row.item.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{detailsModal.areaName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block mb-1">Current Stock</span>
                <span className="text-base font-bold text-slate-900">
                  {detailsModal.row.quantity} {detailsModal.row.item.unit}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block mb-1">Reorder Point</span>
                <span className="text-base font-bold text-slate-900">
                  {detailsModal.row.item.reorderLevel} {detailsModal.row.item.unit}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block mb-1">Daily Usage</span>
                <span className="text-base font-bold text-slate-900">
                  {detailsModal.row.usagePerDay > 0 ? `${detailsModal.row.usagePerDay.toFixed(2)} ${detailsModal.row.item.unit}` : '0.00'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-500 font-bold block mb-1">Days Left</span>
                <span className="text-base font-bold text-slate-900">
                  {detailsModal.row.daysLeft !== null ? `${detailsModal.row.daysLeft.toFixed(1)} days` : '—'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDetailsModal(null)}
                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
