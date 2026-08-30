import { PageHeaderSkeleton, FormSkeleton, TableSkeleton } from "@/components/loading-skeletons";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeaderSkeleton />
      <div className="mb-6">
        <FormSkeleton fields={6} />
      </div>
      <TableSkeleton rows={4} cols={5} />
    </div>
  );
}
