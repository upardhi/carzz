import type { Metadata } from 'next';
import Link from 'next/link';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { isWashFeedbackExpired } from '@/lib/util/washTiming';
import { PublicWashFeedback } from '@/components/feedback/PublicWashFeedback';

export const metadata: Metadata = {
  title: 'Rate Your Car Wash | Carz',
  description: 'View before and after inspection photos and rate your vehicle wash.',
};

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const store = await getStore();

  const visit = await store.visits.get(visitId);

  // Friendly fallback if visit is not in database or demo ID
  if (!visit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-md border border-slate-200 text-center space-y-4">
          <div className="text-4xl">🚗</div>
          <h1 className="text-lg font-bold text-slate-900">Wash Record Not Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            This wash record is no longer available or was from a previous service cycle. You can always view your latest active cars and schedule from the customer portal.
          </p>
          <div className="pt-2">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              Open Carz Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [car, staff] = await Promise.all([
    store.cars.get(visit.carId),
    visit.staffId ? store.staff.get(visit.staffId) : Promise.resolve(null),
  ]);

  const carPlate = car?.plate || 'Your Car';
  const carModel = car ? `${car.make} ${car.model}` : 'Vehicle';
  const washDate = formatDateFull(visit.scheduledDate);
  const beforePhoto = resolvePublicPhotoUrl(visit.beforePhotoUrl);
  const afterPhoto = resolvePublicPhotoUrl(visit.afterPhotoUrl);
  const isExpired = isWashFeedbackExpired(visit);

  return (
    <PublicWashFeedback
      visitId={visit.id}
      carPlate={carPlate}
      carModel={carModel}
      washDate={washDate}
      cleanerName={staff?.name || null}
      servicesDone={visit.servicesDone || []}
      beforePhotoUrl={beforePhoto}
      afterPhotoUrl={afterPhoto}
      initialRating={visit.rating}
      initialComment={visit.ratingComment}
      isExpired={isExpired}
    />
  );
}
