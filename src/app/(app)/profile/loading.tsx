import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSkeleton } from "@/components/loading-skeletons";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
        <div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-52" />
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mb-6">
        <FormSkeleton fields={2} />
      </div>
      <FormSkeleton fields={3} />
    </div>
  );
}
