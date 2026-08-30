import { PageHeaderSkeleton, FormSkeleton } from "@/components/loading-skeletons";

export default function NewMemoLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeaderSkeleton />
      <FormSkeleton fields={5} />
    </div>
  );
}
