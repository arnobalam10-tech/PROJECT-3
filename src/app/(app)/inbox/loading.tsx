import { PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";

export default function InboxLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} cols={7} />
    </div>
  );
}
