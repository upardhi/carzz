import { PageHeader } from '@/components/shell/ConsoleShell';
import { Note } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';
import { GalleryEditor, ReviewsAndMapEditor } from './GalleryEditor';
import {
  BannerEditor,
  ContactEditor,
  PackagesEditor,
  PublishToggle,
  SectionsEditor,
  SeoEditor,
  TestimonialsEditor,
} from './WebsiteEditor';

export const metadata = { title: 'Website' };

export default async function AdminWebsite() {
  await requirePermission('settings:manage');
  const store = await getStore();

  const [content, packages, editor] = await Promise.all([
    store.getSiteContent(),
    store.packages.find(),
    store
      .getSiteContent()
      .then((c) => (c.updatedByUserId ? store.users.get(c.updatedByUserId) : null)),
  ]);

  return (
    <>
      <PageHeader
        title="Website"
        description={
          editor
            ? `Last edited by ${editor.name} on ${formatDateFull(content.updatedAt)}`
            : 'The words on your public website'
        }
      />

      <div className="space-y-3">
        <PublishToggle content={content} />

        <Note tone="brand">
          You control the <b>words</b> here — the layout and design stay
          consistent, so the site cannot end up broken or off-brand. Package
          prices are not edited here either: they come from your Packages
          screen, so what the website advertises is always exactly what a
          customer gets billed.
        </Note>

        <div className="grid gap-3 xl:grid-cols-2">
          <BannerEditor content={content} />
          <SectionsEditor content={content} />
          <PackagesEditor content={content} packages={packages} />
          <GalleryEditor content={content} />
          <ReviewsAndMapEditor content={content} />
          <TestimonialsEditor content={content} />
          <ContactEditor content={content} />
          <SeoEditor content={content} />
        </div>
      </div>
    </>
  );
}
