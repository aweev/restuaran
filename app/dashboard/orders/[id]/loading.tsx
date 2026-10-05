import { LoadingGrid } from "@/components/pos/ui-states";
export default function Loading() {
  return (
    <div className="space-y-4">
      <LoadingGrid count={2} />
    </div>
  );
}
