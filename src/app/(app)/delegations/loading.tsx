import { PageHeaderSkeleton, FormSkeleton, CardListSkeleton } from "@/components/loading-skeletons";

export default function DelegationsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeaderSkeleton />
      <div className="mb-6">
        <FormSkeleton fields={3} />
      </div>
      <CardListSkeleton count={2} />
    </div>
  );
}
