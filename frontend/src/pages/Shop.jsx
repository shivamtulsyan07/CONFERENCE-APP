import { Store } from "lucide-react";
import { SheetFrame } from "../components/SheetFrame";

export default function Shop() {
  return (
    <SheetFrame testId="shop-page" title="Shop" subtitle="Sheets for the shop will live here">
      <div className="sheet-scroll flex items-center justify-center" data-testid="shop-empty">
        <div className="text-center px-6 py-10">
          <Store className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.14em]">No shop sheets yet</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            Tell me which shop sheets you want and they will appear as tabs here.
          </p>
        </div>
      </div>
    </SheetFrame>
  );
}
