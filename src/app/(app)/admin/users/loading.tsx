import { PageHeaderSkeleton, FormSkeleton, TableSkeleton } from "@/components/loading-skeletons";

export default function AdminUsersLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeaderSkeleton />
      <div className="mb-6">
        <FormSkeleton fields={4} />
      </div>
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
