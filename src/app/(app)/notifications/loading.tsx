import { PageHeaderSkeleton, CardListSkeleton } from "@/components/loading-skeletons";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeaderSkeleton />
      <CardListSkeleton count={5} />
    </div>
  );
}
