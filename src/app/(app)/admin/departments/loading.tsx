import { PageHeaderSkeleton, FormSkeleton, TableSkeleton } from "@/components/loading-skeletons";

export default function AdminDepartmentsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeaderSkeleton />
      <div className="mb-6">
        <FormSkeleton fields={2} />
      </div>
      <TableSkeleton rows={4} cols={3} />
    </div>
  );
}
