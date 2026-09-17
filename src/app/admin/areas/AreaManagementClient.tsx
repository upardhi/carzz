'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Button,
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Row,
  Tag,
} from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { IconPlus } from '@/components/shell/icons';
import { LocationPickerMap } from '@/components/ui/LocationPickerMap';
import type { Area, AreaPerformance } from '@/lib/data/types';
import { formatDateFull, money } from '@/lib/util/format';

interface RegionOption {
  id: string;
  name: string;
  areaAdminId?: string | null;
  active?: boolean;
  createdAt?: string | null;
}

interface ManagerOption {
  id: string;
  name: string;
  areaId?: string | null;
}

interface AdminOption {
  id: string;
  name: string;
}

interface Props {
  view: 'regions' | 'areas';
  performance: AreaPerformance[];
  regions: RegionOption[];
  managers: ManagerOption[];
  areaAdmins: AdminOption[];
  cycleLabel: string;
  boysWorking: number;
}

export function AreaManagementClient({
  view,
  performance,
  regions,
  managers,
  areaAdmins,
  cycleLabel,
  boysWorking,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();

  // Reactive state for areas & regions
  const [performanceList, setPerformanceList] = useState<AreaPerformance[]>(performance);
  const [regionList, setRegionList] = useState<RegionOption[]>(regions);

  useEffect(() => {
    setPerformanceList(performance);
  }, [performance]);

  useEffect(() => {
    setRegionList(regions);
  }, [regions]);

  // Modals state
  const [showAddArea, setShowAddArea] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<RegionOption | null>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  // Region search filter state
  const [regionSearch, setRegionSearch] = useState('');

  // Add Area state
  const [areaName, setAreaName] = useState('');
  const [areaCity, setAreaCity] = useState('Nagpur');
  const [areaAddress, setAreaAddress] = useState('');
  const [areaLat, setAreaLat] = useState<number | null>(null);
  const [areaLng, setAreaLng] = useState<number | null>(null);
  const [areaRegionId, setAreaRegionId] = useState(regions[0]?.id ?? '');
  const [areaManagerId, setAreaManagerId] = useState('');
  const [pendingArea, setPendingArea] = useState(false);
  const [areaError, setAreaError] = useState('');

  // Region Form state (Add / Edit)
  const [regionName, setRegionName] = useState('');
  const [regionAdminId, setRegionAdminId] = useState('');
  const [pendingRegion, setPendingRegion] = useState(false);
  const [deletingRegionId, setDeletingRegionId] = useState<string | null>(null);
  const [togglingRegionId, setTogglingRegionId] = useState<string | null>(null);
  const [regionError, setRegionError] = useState('');

  const [togglingAreaId, setTogglingAreaId] = useState<string | null>(null);
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);

  // Edit Area state
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);
  const [editRegionId, setEditRegionId] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [pendingEdit, setPendingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const adminById = new Map(areaAdmins.map((a) => [a.id, a]));
  const regionById = new Map(regionList.map((r) => [r.id, r]));

  // Areas that belong to each region, by name
  const areasByRegionId = new Map<string, string[]>();
  for (const p of performanceList) {
    const rId = p.area.regionId;
    if (rId) {
      areasByRegionId.set(rId, [...(areasByRegionId.get(rId) || []), p.area.name]);
    }
  }

  function openAddRegionModal() {
    setEditingRegion(null);
    setRegionName('');
    setRegionAdminId('');
    setRegionError('');
    setShowRegionModal(true);
  }

  function openEditRegionModal(region: RegionOption) {
    setEditingRegion(region);
    setRegionName(region.name);
    setRegionAdminId(region.areaAdminId || '');
    setRegionError('');
    setShowRegionModal(true);
  }

  function openEditAreaModal(area: Area) {
    setEditingArea(area);
    setEditName(area.name);
    setEditCity(area.city || 'Nagpur');
    setEditAddress(area.address || '');
    setEditLat(area.lat ?? null);
    setEditLng(area.lng ?? null);
    setEditRegionId(area.regionId);
    setEditManagerId(area.managerId || '');
    setEditError('');
  }

  async function handleSaveRegion(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = regionName.trim();
    if (!trimmedName) {
      setRegionError('Please enter a region name.');
      return;
    }

    setPendingRegion(true);
    setRegionError('');

    const isEditing = Boolean(editingRegion);
    const payload = isEditing
      ? {
          action: 'updateRegion',
          regionId: editingRegion!.id,
          name: trimmedName,
          areaAdminId: regionAdminId ? regionAdminId : null,
        }
      : {
          action: 'createRegion',
          name: trimmedName,
          areaAdminId: regionAdminId ? regionAdminId : null,
        };

    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setRegionError(data.error || 'Failed to save region.');
        toast.error(data.error || 'Failed to save region.');
        return;
      }

      toast.success(
        data.message ||
          (isEditing ? 'Region updated successfully!' : 'Region created successfully!'),
      );

      if (data.region) {
        const updatedRegion: RegionOption = {
          id: data.region.id,
          name: data.region.name,
          areaAdminId: data.region.areaAdminId ?? null,
          createdAt: data.region.createdAt ?? null,
        };

        if (isEditing) {
          setRegionList((prev) =>
            prev.map((r) => (r.id === updatedRegion.id ? updatedRegion : r)),
          );
        } else {
          setRegionList((prev) => [...prev, updatedRegion]);
        }
      }

      setRegionName('');
      setRegionAdminId('');
      setEditingRegion(null);
      setShowRegionModal(false);
      router.refresh();
    } catch {
      setRegionError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setPendingRegion(false);
    }
  }

  async function handleDeleteRegion(region: RegionOption) {
    const areaCount = (areasByRegionId.get(region.id) || []).length;
    const confirmMsg =
      areaCount > 0
        ? `Region "${region.name}" has ${areaCount} active ${
            areaCount === 1 ? 'area' : 'areas'
          } assigned to it. Deleting it will fail unless those areas are reassigned or removed.`
        : `Are you sure you want to delete region "${region.name}"? This action cannot be undone.`;

    const confirmed = await confirm({
      title: `Delete Region "${region.name}"`,
      message: confirmMsg,
      confirmText: 'Delete Region',
      tone: 'danger',
    });

    if (!confirmed) return;

    setDeletingRegionId(region.id);
    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteRegion',
          regionId: region.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete region.');
        return;
      }

      toast.success(data.message || `Region "${region.name}" deleted successfully.`);
      setRegionList((prev) => prev.filter((r) => r.id !== region.id));
      router.refresh();
    } catch {
      toast.error('Network error while deleting region.');
    } finally {
      setDeletingRegionId(null);
    }
  }

  async function handleToggleRegionActive(region: RegionOption) {
    const nextActive = !(region.active ?? true);
    const confirmed = await confirm({
      title: nextActive ? `Enable Region "${region.name}"` : `Disable Region "${region.name}"`,
      message: nextActive
        ? `Re-enable "${region.name}"? Everyone assigned to it will be able to sign in again.`
        : `Disable "${region.name}"? Nobody assigned to this region — Area Admins, Managers, ` +
          `Boys — will not be able to sign in until it is re-enabled.`,
      confirmText: nextActive ? 'Enable' : 'Disable',
      tone: nextActive ? 'primary' : 'danger',
    });
    if (!confirmed) return;

    setTogglingRegionId(region.id);
    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setRegionActive',
          regionId: region.id,
          active: nextActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update region.');
        return;
      }

      toast.success(data.message || `Region "${region.name}" updated.`);
      setRegionList((prev) =>
        prev.map((r) => (r.id === region.id ? { ...r, active: nextActive } : r)),
      );
      router.refresh();
    } catch {
      toast.error('Network error while updating region.');
    } finally {
      setTogglingRegionId(null);
    }
  }

  async function handleToggleAreaActive(area: Area) {
    const nextActive = !area.active;
    const confirmed = await confirm({
      title: nextActive ? `Enable Area "${area.name}"` : `Disable Area "${area.name}"`,
      message: nextActive
        ? `Re-enable "${area.name}"? Its manager and boys will be able to sign in again.`
        : `Disable "${area.name}"? Its manager and boys will not be able to sign in until it ` +
          `is re-enabled.`,
      confirmText: nextActive ? 'Enable' : 'Disable',
      tone: nextActive ? 'primary' : 'danger',
    });
    if (!confirmed) return;

    setTogglingAreaId(area.id);
    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setAreaActive',
          areaId: area.id,
          active: nextActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update area.');
        return;
      }

      toast.success(data.message || `Area "${area.name}" updated.`);
      setPerformanceList((prev) =>
        prev.map((p) =>
          p.area.id === area.id ? { ...p, area: { ...p.area, active: nextActive } } : p,
        ),
      );
      router.refresh();
    } catch {
      toast.error('Network error while updating area.');
    } finally {
      setTogglingAreaId(null);
    }
  }

  async function handleDeleteArea(area: Area) {
    const confirmed = await confirm({
      title: `Delete Area "${area.name}"`,
      message:
        `Are you sure you want to delete "${area.name}"? This action cannot be undone. ` +
        `It fails if any customers or staff are still assigned to it — disable it instead if ` +
        `you just want to stop new work there.`,
      confirmText: 'Delete Area',
      tone: 'danger',
    });
    if (!confirmed) return;

    setDeletingAreaId(area.id);
    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteArea',
          areaId: area.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete area.');
        return;
      }

      toast.success(data.message || `Area "${area.name}" deleted successfully.`);
      setPerformanceList((prev) => prev.filter((p) => p.area.id !== area.id));
      router.refresh();
    } catch {
      toast.error('Network error while deleting area.');
    } finally {
      setDeletingAreaId(null);
    }
  }

  async function handleCreateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!areaName.trim() || !areaCity.trim() || !areaRegionId) {
      setAreaError('Please enter an area name, city, and select a region.');
      return;
    }

    setPendingArea(true);
    setAreaError('');

    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: areaName.trim(),
          city: areaCity.trim(),
          address: areaAddress.trim() || null,
          lat: areaLat,
          lng: areaLng,
          regionId: areaRegionId,
          managerId: areaManagerId ? areaManagerId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAreaError(data.error || 'Failed to create area.');
        toast.error(data.error || 'Failed to create area.');
        return;
      }

      toast.success(data.message || 'Area created successfully!');

      if (data.area) {
        const newPerformanceItem: AreaPerformance = {
          area: data.area,
          customers: 0,
          activeCars: 0,
          staff: 0,
          billed: 0,
          collected: 0,
          outstanding: 0,
          payoutCost: 0,
          goodsCost: 0,
          profit: 0,
          margin: 0,
          washesDone: 0,
          washesMissed: 0,
          averageRating: 0,
          openComplaints: 0,
        };
        setPerformanceList((prev) => [...prev, newPerformanceItem]);
      }

      setAreaName('');
      setAreaAddress('');
      setAreaLat(null);
      setAreaLng(null);
      setAreaManagerId('');
      setShowAddArea(false);
      router.refresh();
    } catch {
      setAreaError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setPendingArea(false);
    }
  }

  async function handleUpdateArea(e: React.FormEvent) {
    e.preventDefault();
    if (!editingArea) return;
    if (!editName.trim() || !editCity.trim() || !editRegionId) {
      setEditError('Please enter an area name, city, and select a region.');
      return;
    }

    setPendingEdit(true);
    setEditError('');

    try {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          areaId: editingArea.id,
          name: editName.trim(),
          city: editCity.trim(),
          address: editAddress.trim() || null,
          lat: editLat,
          lng: editLng,
          regionId: editRegionId,
          managerId: editManagerId ? editManagerId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update area.');
        toast.error(data.error || 'Failed to update area.');
        return;
      }

      toast.success(data.message || 'Area updated successfully!');

      if (data.area) {
        setPerformanceList((prev) =>
          prev.map((item) =>
            item.area.id === data.area.id ? { ...item, area: data.area } : item,
          ),
        );
      }

      setEditingArea(null);
      router.refresh();
    } catch {
      setEditError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setPendingEdit(false);
    }
  }

  const filteredRegions = regionList.filter((r) =>
    r.name.toLowerCase().includes(regionSearch.trim().toLowerCase()),
  );

  return (
    <>
      {/* Page Header — actions live below, next to each section they act on */}
      <PageHeader
        title={view === 'regions' ? 'Regions' : 'Areas'}
        description={
          view === 'regions'
            ? 'Geographical clusters, each run by one Area Admin'
            : `${cycleLabel} · compare side by side to decide where to expand`
        }
      />

      {/* KPI Grid */}
      <KpiGrid columns={5}>
        <Kpi
          label="ACTIVE AREAS"
          value={performanceList.length}
          tone="purple"
          subtext="Coverage regions"
        />
        <Kpi
          label="TOTAL CUSTOMERS"
          value={performanceList.reduce((s, p) => s + p.customers, 0)}
          tone="blue"
          subtext="Subscribed accounts"
        />
        <Kpi
          label="TOTAL COLLECTED"
          value={money(performanceList.reduce((s, p) => s + p.collected, 0))}
          tone="emerald"
          subtext="Revenue collected"
        />
        <Kpi
          label="TOTAL BOYS WORKING"
          value={boysWorking}
          tone="emerald"
          subtext="Active wash staff"
        />
        <Kpi
          label="PENDING DUES"
          value={money(performanceList.reduce((s, p) => s + p.outstanding, 0))}
          tone="rose"
          subtext="Billed but not collected"
        />
      </KpiGrid>

      {/* Region List Section */}
      {view === 'regions' && (
      <div id="regions" className="mt-6 scroll-mt-4">
        <Card className="p-0 overflow-hidden border border-line shadow-sm">
          {/* Header & Search Bar */}
          <div className="p-4 border-b border-line bg-surface flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardHeading>Regions</CardHeading>
              <p className="text-xs text-ink-mute">
                Geographical region clusters and assigned Area Admins
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[200px] max-w-xs">
                <input
                  type="text"
                  placeholder="Filter regions..."
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-elevated py-1.5 pl-8 pr-7 text-xs placeholder:text-ink-mute focus:border-blue-600 focus:outline-none"
                />
                <svg
                  className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-mute"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {regionSearch ? (
                  <button
                    type="button"
                    onClick={() => setRegionSearch('')}
                    className="absolute right-2 top-2 text-xs text-ink-mute hover:text-ink"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              <Button variant="secondary" size="sm" onClick={openAddRegionModal}>
                <IconPlus width={14} height={14} />
                <span>Add Region</span>
              </Button>
            </div>
          </div>

          {/* Region Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-elevated text-xs uppercase font-semibold text-ink-mute">
                <tr>
                  <th className="py-3 px-4">Region Name</th>
                  <th className="py-3 px-4">Areas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredRegions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-ink-mute">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg
                          className="h-8 w-8 text-ink-mute opacity-50"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a2.5 2.5 0 002.5-2.5V11a2 2 0 012-2h1.065M15 20.488V18a2 2 0 012-2h3.064"
                          />
                        </svg>
                        <p className="font-semibold text-sm text-ink">No regions found</p>
                        <p className="text-xs">
                          {regionSearch
                            ? 'No regions match your search filter.'
                            : 'Get started by adding your first coverage region.'}
                        </p>
                        {!regionSearch && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="mt-2"
                            onClick={openAddRegionModal}
                          >
                            <IconPlus width={14} height={14} />
                            <span>Add Region</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRegions.map((region) => {
                    const regionAreaNames = areasByRegionId.get(region.id) || [];
                    const isActive = region.active ?? true;

                    return (
                      <tr
                        key={region.id}
                        className={`hover:bg-surface-elevated/50 transition-colors ${
                          isActive ? '' : 'bg-surface-sunken/60 opacity-60'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-navy-950">
                          {region.name}
                        </td>
                        <td className="py-3 px-4">
                          {regionAreaNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {regionAreaNames.map((name) => (
                                <Tag key={name} tone="info">
                                  {name}
                                </Tag>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-faint italic">No areas yet</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Tag tone={isActive ? 'ok' : 'bad'}>
                            {isActive ? 'Active' : 'Disabled'}
                          </Tag>
                        </td>
                        <td className="py-3 px-4 text-xs text-ink-mute whitespace-nowrap" suppressHydrationWarning>
                          {region.createdAt ? formatDateFull(region.createdAt) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditRegionModal(region)}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-ink hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              title="Edit Region"
                            >
                              <svg
                                width={12}
                                height={12}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={togglingRegionId === region.id}
                              onClick={() => handleToggleRegionActive(region)}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-surface-raised hover:text-ink transition-colors disabled:opacity-40"
                              title={isActive ? 'Disable Region' : 'Enable Region'}
                            >
                              <span>
                                {togglingRegionId === region.id
                                  ? 'Saving…'
                                  : isActive
                                    ? 'Disable'
                                    : 'Enable'}
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingRegionId === region.id}
                              onClick={() => handleDeleteRegion(region)}
                              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-40"
                              title="Delete Region"
                            >
                              <svg
                                width={12}
                                height={12}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              <span>
                                {deletingRegionId === region.id ? 'Deleting…' : 'Delete'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      )}

      {/* Area Cards Grid */}
      {view === 'areas' && (
      <div id="areas" className="mt-6 scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <CardHeading>Coverage Areas</CardHeading>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-mute font-medium">
              {performanceList.length} active coverage areas
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAreaError('');
                setAreaAddress('');
                if (
                  regionList.length > 0 &&
                  (!areaRegionId || !regionList.some((r) => r.id === areaRegionId))
                ) {
                  setAreaRegionId(regionList[0].id);
                }
                setShowAddArea(true);
              }}
            >
              <IconPlus width={14} height={14} />
              <span>Add Area</span>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {performanceList.map((area) => {
            const region = regionById.get(area.area.regionId);
            const admin = region?.areaAdminId
              ? adminById.get(region.areaAdminId)
              : null;

            const isActive = area.area.active;

            return (
              <Card
                key={area.area.id}
                className={`p-4 flex flex-col justify-between ${isActive ? '' : 'opacity-60 grayscale'}`}
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-navy-950 flex items-center gap-1.5">
                        {area.area.name}
                        {!isActive && <Tag tone="bad">Disabled</Tag>}
                      </h3>
                      <p className="text-xs text-ink-mute">
                        {admin ? admin.name : 'No area admin assigned'}
                        {' · '}
                        {region ? region.name : ''}
                      </p>
                      {area.area.address ? (
                        <div
                          className="mt-1 flex items-start gap-1 text-[11px] text-ink-soft"
                          title={area.area.address}
                        >
                          <span className="shrink-0 pt-0.5">📍</span>
                          {area.area.lat !== null && area.area.lat !== undefined && area.area.lng !== null && area.area.lng !== undefined ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${area.area.lat},${area.area.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-600 hover:underline inline-flex items-center gap-0.5 leading-snug break-words line-clamp-2"
                            >
                              <span>{area.area.address}</span>
                              <span className="text-[9px] text-blue-600 shrink-0 mt-0.5 self-start">↗</span>
                            </a>
                          ) : (
                            <span className="leading-snug break-words line-clamp-2">{area.area.address}</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditAreaModal(area.area)}
                        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-raised hover:text-ink transition-colors"
                        title="Edit Area"
                      >
                        <svg
                          width={11}
                          height={11}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={togglingAreaId === area.area.id}
                        onClick={() => handleToggleAreaActive(area.area)}
                        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft hover:bg-surface-raised hover:text-ink transition-colors disabled:opacity-40"
                        title={isActive ? 'Disable Area' : 'Enable Area'}
                      >
                        {togglingAreaId === area.area.id
                          ? 'Saving…'
                          : isActive
                            ? 'Disable'
                            : 'Enable'}
                      </button>
                      <button
                        type="button"
                        disabled={deletingAreaId === area.area.id}
                        onClick={() => handleDeleteArea(area.area)}
                        className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-40"
                        title="Delete Area"
                      >
                        {deletingAreaId === area.area.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  <Row label="Customers" value={area.customers} />
                  <Row label="Cars" value={area.activeCars} />
                  <Row label="Staff" value={area.staff} />
                  <Row
                    label="Capacity load"
                    value={
                      area.staff === 0
                        ? area.activeCars > 0
                          ? `⚠️ ${area.activeCars} cars (No staff)`
                          : '0 cars (Idle)'
                        : `~${Math.round(area.activeCars / area.staff)} cars/boy (${
                            area.activeCars / area.staff > 15
                              ? 'High load'
                              : area.activeCars / area.staff >= 10
                                ? 'Optimal'
                                : 'Healthy'
                          })`
                    }
                    tone={
                      (area.staff === 0 && area.activeCars > 0) ||
                      (area.staff > 0 && area.activeCars / area.staff > 15)
                        ? 'danger'
                        : 'success'
                    }
                  />
                  <Row label="Collected" value={money(area.collected)} tone="success" />
                  <Row label="Outstanding" value={money(area.outstanding)} tone="gold" />
                  <Row label="Staff cost" value={money(area.payoutCost)} />
                  <Row label="Goods cost" value={money(area.goodsCost)} />
                  <Row
                    label="Missed washes"
                    value={area.washesMissed}
                    tone={area.washesMissed > 30 ? 'danger' : undefined}
                  />
                  <Row
                    label="Rating"
                    value={
                      area.averageRating ? `${area.averageRating.toFixed(1)} ★` : '—'
                    }
                  />
                </div>

                {/* Action Button: View Schedule & Washes */}
                <div className="mt-4 pt-3 border-t border-line-soft">
                  <a
                    href={`/admin/areas/${area.area.id}`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold text-navy-800 bg-navy-50 hover:bg-navy-100 rounded-xl transition-colors border border-navy-200/60 shadow-2xs"
                  >
                    <span>View Schedule & Washes</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      )}

      {/* Modal: Add Area */}
      {showAddArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Add New Area</h3>
                <p className="text-xs text-ink-mute">
                  Create a coverage area for car wash operations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddArea(false)}
                className="rounded-lg p-1.5 text-ink-mute hover:bg-surface-raised hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateArea} className="space-y-3.5">
              <div>
                <label className="field-label" htmlFor="area-name">
                  Area Name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="area-name"
                  className="field"
                  placeholder="e.g. Dharampeth, Kothrud, Bandra"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="area-city">
                  City <span className="text-danger-500">*</span>
                </label>
                <input
                  id="area-city"
                  className="field"
                  placeholder="e.g. Nagpur, Pune, Mumbai"
                  value={areaCity}
                  onChange={(e) => setAreaCity(e.target.value)}
                  required
                />
              </div>

              <LocationPickerMap
                address={areaAddress}
                lat={areaLat}
                lng={areaLng}
                city={areaCity || 'Nagpur'}
                onAddressChange={(newAddress) => setAreaAddress(newAddress)}
                onCoordinatesChange={(newLat, newLng) => {
                  setAreaLat(newLat);
                  setAreaLng(newLng);
                }}
              />

              <div>
                <label className="field-label" htmlFor="area-region">
                  Region <span className="text-danger-500">*</span>
                </label>
                <select
                  id="area-region"
                  className="field"
                  value={areaRegionId}
                  onChange={(e) => setAreaRegionId(e.target.value)}
                  required
                >
                  {regionList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {areaError ? (
                <div className="mt-2">
                  <Note tone="danger">{areaError}</Note>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-line-soft pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddArea(false)}
                  disabled={pendingArea}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pendingArea || !areaName.trim() || !areaCity.trim()}
                >
                  {pendingArea ? 'Creating…' : 'Create Area'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Area */}
      {editingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  Edit Area: {editingArea.name}
                </h3>
                <p className="text-xs text-ink-mute">
                  Update area details, garage address, and manager
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingArea(null)}
                className="rounded-lg p-1.5 text-ink-mute hover:bg-surface-raised hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateArea} className="space-y-3.5">
              <div>
                <label className="field-label" htmlFor="edit-area-name">
                  Area Name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="edit-area-name"
                  className="field"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="edit-area-city">
                  City <span className="text-danger-500">*</span>
                </label>
                <input
                  id="edit-area-city"
                  className="field"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  required
                />
              </div>

              <LocationPickerMap
                address={editAddress}
                lat={editLat}
                lng={editLng}
                city={editCity || 'Nagpur'}
                onAddressChange={(newAddress) => setEditAddress(newAddress)}
                onCoordinatesChange={(newLat, newLng) => {
                  setEditLat(newLat);
                  setEditLng(newLng);
                }}
              />

              <div>
                <label className="field-label" htmlFor="edit-area-region">
                  Region <span className="text-danger-500">*</span>
                </label>
                <select
                  id="edit-area-region"
                  className="field"
                  value={editRegionId}
                  onChange={(e) => setEditRegionId(e.target.value)}
                  required
                >
                  {regionList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="edit-area-manager">
                  Assigned Manager
                </label>
                <select
                  id="edit-area-manager"
                  className="field"
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                >
                  <option value="">(No manager assigned)</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.id === editingArea.managerId ? '✓ Current' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {editError ? (
                <div className="mt-2">
                  <Note tone="danger">{editError}</Note>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-line-soft pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingArea(null)}
                  disabled={pendingEdit}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pendingEdit || !editName.trim() || !editCity.trim()}
                >
                  {pendingEdit ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Unified Add / Edit Region */}
      {showRegionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {editingRegion ? `Edit Region: ${editingRegion.name}` : 'Add New Region'}
                </h3>
                <p className="text-xs text-ink-mute">
                  {editingRegion
                    ? 'Update the region name'
                    : 'Create a regional cluster of coverage areas'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegionModal(false)}
                className="rounded-lg p-1.5 text-ink-mute hover:bg-surface-raised hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRegion} className="space-y-3.5">
              <div>
                <label className="field-label" htmlFor="region-name">
                  Region Name <span className="text-danger-500">*</span>
                </label>
                <input
                  id="region-name"
                  className="field"
                  placeholder="e.g. Nagpur Urban, Pune East, Mumbai Suburban"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {regionError ? (
                <div className="mt-2">
                  <Note tone="danger">{regionError}</Note>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-line-soft pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRegionModal(false)}
                  disabled={pendingRegion}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pendingRegion || !regionName.trim()}
                >
                  {pendingRegion
                    ? 'Saving…'
                    : editingRegion
                      ? 'Save Changes'
                      : 'Create Region'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
