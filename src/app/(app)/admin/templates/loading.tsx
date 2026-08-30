import { PageHeaderSkeleton, FormSkeleton, CardListSkeleton } from "@/components/loading-skeletons";

export default function AdminTemplatesLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeaderSkeleton />
      <div className="mb-6">
        <FormSkeleton fields={3} />
      </div>
      <CardListSkeleton count={3} />
    </div>
  );
}
