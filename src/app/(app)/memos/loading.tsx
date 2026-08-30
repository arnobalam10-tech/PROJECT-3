import { PageHeaderSkeleton, TableSkeleton } from "@/components/loading-skeletons";

export default function MyMemosLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
